const { neonprisma } = require("../lib/neon");

const { Prisma } = require("../generated/neon/client.js");
async function getItemWiseSummary(fromDate, toDate, compNo = 1) {
  const summary = await neonprisma.sales_items.aggregate({
    where: {
      sales_entries: {
        comp_no: compNo,
        code: "S",
        bill_date: {
          gte: new Date(fromDate),
          lt: new Date(toDate),
        },
      },
    },
    _sum: {
      pcs: true,
      meters: true,
      weight: true,
      amount: true,
      taxable: true,
      final_amount: true,
    },
    _count: {
      id: true,
    },
  });

  const uniqueItems = await neonprisma.sales_items.groupBy({
    by: ["item_name"],
    where: {
      sales_entries: {
        code: "S",
        comp_no: compNo,
      },
    },
  });

  const topItems = await neonprisma.sales_items.groupBy({
    by: ["item_name", "per"],
    where: {
      sales_entries: {
        comp_no: compNo,
        code: "S",
      },
    },
    _sum: {
      pcs: true,
      meters: true,
      weight: true,
      amount: true,
      final_amount: true,
    },
    orderBy: {
      _sum: {
        final_amount: "desc",
      },
    },
  });

  const returnItems = await neonprisma.sales_items.groupBy({
    by: ["item_name", "per"],
    where: {
      sales_entries: {
        comp_no: compNo,
        code: "SR",
      },
    },
    _sum: {
      pcs: true,
      meters: true,
      weight: true,
      amount: true,
      final_amount: true,
    },
    orderBy: {
      _sum: {
        final_amount: "desc",
      },
    },
  });

  return {
    summary: {
      totalPcs: summary._sum.pcs ?? 0,
      totalMeters: summary._sum.meters ?? 0,
      totalWeight: summary._sum.weight ?? 0,
      totalTaxable: summary._sum.taxable ?? 0,
      totalTransaction: summary._sum.final_amount ?? 0,
      totalUniqueItems: uniqueItems.length ?? 0,
    },
    topItems: topItems.map((item) => ({
      itemName: item.item_name,
      pcs: item._sum.pcs ?? 0,
      meters: item._sum.meters ?? 0,
      weight: item._sum.weight ?? 0,
      per: item.per,
      transaction: item._sum.final_amount ?? 0,
    })),
    returnItems: returnItems.map((item) => ({
      itemName: item.item_name,
      pcs: item._sum.pcs ?? 0,
      meters: item._sum.meters ?? 0,
      weight: item._sum.weight ?? 0,
      per: item.per,
      transaction: item._sum.final_amount ?? 0,
    })),
  };
}

async function getSalesKPI(fromDate, toDate) {
  const sales = await neonprisma.sales_entries.aggregate({
    where: {
      code: "S",
      bill_date: {
        gte: new Date(fromDate),
        lt: new Date(toDate),
      },
    },
    _sum: {
      net_amount: true,
      cgst: true,
      sgst: true,
      igst: true,
    },
    _count: {
      entry_id: true,
    },
  });
  const salesReturns = await neonprisma.sales_entries.aggregate({
    where: {
      code: "SR",
      bill_date: {
        gte: new Date(fromDate),
        lt: new Date(toDate),
      },
    },
    _sum: {
      net_amount: true,
      cgst: true,
      sgst: true,
      igst: true,
    },
    _count: {
      entry_id: true,
    },
  });
  const grossAmount = Number(sales._sum.net_amount ?? 0);

  const returns = Number(salesReturns._sum.net_amount ?? 0);

  const netAmount = grossAmount - returns;

  const invoiceCount = Number(sales._count.entry_id ?? 0);
  const returnCount = Number(salesReturns._count.entry_id ?? 0);
  const cgst = Number(sales._sum.cgst ?? 0);
  const sgst = Number(sales._sum.sgst ?? 0);
  const igst = Number(sales._sum.igst ?? 0);
  const cgstReturn = Number(salesReturns._sum.cgst ?? 0);
  const sgstReturn = Number(salesReturns._sum.sgst ?? 0);
  const igstReturn = Number(salesReturns._sum.igst ?? 0);
  const salesData = {
    grossAmount,
    returns,
    netAmount,
    invoiceCount,
    returnCount,
    cgst,
    igst,
    sgst,
    cgstReturn,
    sgstReturn,
    igstReturn,
  };
  return salesData;
}

async function getSalesByCustomer(
  fromDate,
  toDate,
  searchFilter = Prisma.empty,
) {
  const result = await neonprisma.$queryRaw`
  SELECT
    party,

    COALESCE(
      SUM(net_amount) FILTER (
        WHERE code = 'S'
      ),
      0
    ) AS sales_amount,

    COALESCE(
      SUM(net_amount) FILTER (
        WHERE code = 'SR'
      ),
      0
    ) AS return_amount,

    COALESCE(
      SUM(net_amount) FILTER (
        WHERE code = 'S'
      ),
      0
    )
    -
    COALESCE(
      SUM(net_amount) FILTER (
        WHERE code = 'SR'
      ),
      0
    ) AS net_sales,

    COUNT(*) FILTER (
      WHERE code = 'S'
    ) AS invoice_count

  FROM sales_entries

  WHERE code IN ('S', 'SR')
    AND bill_date >= ${fromDate}
    AND bill_date < ${toDate}
    ${searchFilter}
  GROUP BY party

  ORDER BY net_sales DESC
`;
  return result.map((row) => ({
    party: row.party,
    grossAmount: Number(row.sales_amount),
    returnAmount: Number(row.return_amount),
    netAmount: Number(row.net_sales),
    invoiceCount: Number(row.invoice_count),
  }));
}

async function getCustomerPurchases(fromDate, toDate, party) {
  const partyData = await neonprisma.sales_entries.findMany({
    where: { party, code: { in: ["S", "SR"] } },
    select: {
      comp_no: true,
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      agent: true,
      net_amount: true,
      sales_items: {
        select: {
          item_name: true,
          pcs: true,
          meters: true,
          weight: true,
          per: true,
          discount: true,
          rate: true,
          final_amount: true,
        },
      },
    },
    orderBy: { bill_date: "desc" },
  });

  return partyData.flatMap((row) =>
    row.sales_items.map((item) => ({
      compNo: row.comp_no,
      code: row.code,
      billNo: row.bill_no,
      billDate: row.bill_date,
      party: row.party,
      agent: row.agent,
      netAmount: row.net_amount,
      itemName: item.item_name,
      pcs: item.pcs,
      meters: item.meters,
      weight: item.weight,
      per: item.per,
      discount: item.discount,
      rate: item.rate,
      totalAmount: item.final_amount,
    })),
  );
}

module.exports = {
  getItemWiseSummary,
  getSalesByCustomer,
  getSalesKPI,
  getCustomerPurchases,
};

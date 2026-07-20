const { neonprisma } = require("../lib/neon");

async function getDateRangeSales(startDate, endDate) {
  const data = await neonprisma.bills.findMany({
    select: {
      bill_date: true,
      party: true,
      net_amt: true,
    },
    where: {
      code: "S",
      bill_date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
  });
  return data;
}

async function getSalesKPI(fromDate, toDate) {
  const sales = await neonprisma.bills.aggregate({
    where: {
      code: "S",
      bill_date: {
        gte: new Date(fromDate),
        lt: new Date(toDate),
      },
    },
    _sum: {
      net_amt: true,
      cgst: true,
      sgst: true,
      igst: true,
    },
    _count: {
      entry_id: true,
    },
  });

  const salesReturns = await neonprisma.bills.aggregate({
    where: {
      code: "SR",
      bill_date: {
        gte: new Date(fromDate),
        lt: new Date(toDate),
      },
    },
    _sum: {
      net_amt: true,
      cgst: true,
      sgst: true,
      igst: true,
    },
    _count: {
      entry_id: true,
    },
  });
  const grossSales = Number(sales._sum.net_amt ?? 0);

  const returns = Number(salesReturns._sum.net_amt ?? 0);

  const netSales = grossSales - returns;

  const invoiceCount = Number(sales._count.entry_id ?? 0);
  const returnCount = Number(salesReturns._count.entry_id ?? 0);
  const cgstSales = Number(sales._sum.cgst ?? 0);
  const sgstSales = Number(sales._sum.sgst ?? 0);
  const igstSales = Number(sales._sum.igst ?? 0);
  const cgstSalesReturn = Number(salesReturns._sum.cgst ?? 0);
  const sgstSalesReturn = Number(salesReturns._sum.sgst ?? 0);
  const igstSalesReturn = Number(salesReturns._sum.igst ?? 0);
  const salesData = {
    grossSales,
    returns,
    netSales,
    invoiceCount,
    returnCount,
    cgstSales,
    igstSales,
    sgstSales,
    cgstSalesReturn,
    sgstSalesReturn,
    igstSalesReturn,
  };
  return salesData;
}

async function getSalesByCustomer(fromDate, toDate) {
  const result = await neonprisma.$queryRaw`
  SELECT
    party,

    COALESCE(
      SUM(net_amt) FILTER (
        WHERE code = 'S'
      ),
      0
    ) AS sales_amount,

    COALESCE(
      SUM(net_amt) FILTER (
        WHERE code = 'SR'
      ),
      0
    ) AS return_amount,

    COALESCE(
      SUM(net_amt) FILTER (
        WHERE code = 'S'
      ),
      0
    )
    -
    COALESCE(
      SUM(net_amt) FILTER (
        WHERE code = 'SR'
      ),
      0
    ) AS net_sales,

    COUNT(*) FILTER (
      WHERE code = 'S'
    ) AS invoice_count

  FROM bills

  WHERE code IN ('S', 'SR')
    AND bill_date >= ${fromDate}
    AND bill_date < ${toDate}

  GROUP BY party

  ORDER BY net_sales DESC
`;
  return result.map((row) => ({
    party: row.party,
    salesAmount: Number(row.sales_amount),
    returnAmount: Number(row.return_amount),
    netSales: Number(row.net_sales),
    invoiceCount: Number(row.invoice_count),
  }));
}

async function getTrend(filters) {
  return { filters, data: [] };
}

module.exports = {
  getDateRangeSales,
  getSalesByCustomer,
  getTrend,
  getSalesKPI,
};

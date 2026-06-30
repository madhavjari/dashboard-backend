SELECT

    -- BillMaster
    bm.EntryId,
    bm.CompNo,
    bm.Code,
    bm.Book,
    bm.Serial,
    bm.SrChr,
    bm.BillNo,
    bm.BillChr,
    bm.Date,
    bm.Party,
    bm.PartyCode,
    bm.Agent,

    bm.GrossAmt    AS GrossAmount,
    bm.NetAmt      AS NetAmount,
    bm.CGSTAmt,
    bm.SGSTAmt,
    bm.IGSTAmt,

    bm._EntryDate,
    bm._ModifyDate,
    bm._ModifyTime,

    -- BillData
    bd.EntryId       AS DetailEntryId,
    bd.Serial        AS ItemSerial,

    bd.ItemCode,
    bd.ItemName,

    bd.Category,
    bd.GroupName,
    bd.Brand,
    bd.Quality,
    bd.Design,
    bd.Colour,
    bd.Pattern,

    bd.Pcs,
    bd.Meters,
    bd.Weight,
    bd.Quantity,

    bd.Rate,
    bd.Per,

    bd.Amount        AS ItemAmount,
    bd.TaxableValue  AS ItemTaxableValue,
    bd.FinalAmt      AS ItemFinalAmount,

    bd.DiscPer,
    bd.DiscAmt,

    bd.CGSTRate,
    bd.CGSTAmt,

    bd.SGSTRate,
    bd.SGSTAmt,

    bd.IGSTRate,
    bd.IGSTAmt,

    bd.CessRate,
    bd.CessAmt,

    bd.Remarks

    FROM BillMast bm

    INNER JOIN BillData bd
    ON bm.EntryId = bd.ControlId

    ORDER BY
    bm.EntryId,
    bd.Serial;

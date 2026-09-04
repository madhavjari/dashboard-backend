const { z } = require("zod");

const { findUser } = require("../db/authQueries");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(32, "Password must have less than 32 characters")
  .regex(/[A-Z]/, {
    message: "Password must contain at least one uppercase letter",
  })
  .regex(/[a-z]/, {
    message: "Password must contain at least one lowercase letter",
  })
  .regex(/[0-9]/, {
    message: "Password must contain at least one number",
  })
  .regex(/[^A-Za-z0-9]/, {
    message: "Password must contain at least one special character",
  });

const registerSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .min(2, "First Name must be at least 2 characters")
        .max(32, "First Name must be less than 32 characters"),
      lastName: z
        .string()
        .min(2, "Last Name must be at least 2 characters")
        .max(32, "Last Name must be less than 32 characters"),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .min(1, "Email is Required.")
        .max(100, "Email must be less than 100 characters")
        .pipe(z.email("Email is invalid"))
        .refine(
          async (email) => {
            const user = await findUser(["id"], { email: email });
            return !user;
          },
          { message: "Email already taken" },
        ),
      companyName: z
        .string()
        .trim()
        .min(2, "Username must be at least 2 characters long")
        .max(32, "Username must have less than 32 characters"),
      phoneNumber: z
        .string()
        .trim()
        .regex(/^\+91\d{10}$/, {
          message:
            "Security alert: Must be a valid +91 country code followed by 10 digits.",
        })
        .pipe(z.e164()),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is Required.")
      .max(100, "Email must be less than 100 characters")
      .pipe(z.email("Email is invalid")),
    password: z
      .string()
      .min(1, "Password is require")
      .max(32, "Let's not enter too large password"),
  }),
});

const passwordResetSchema = z.object({
  query: z.object({
    token: z.string().min(1, "Token is required"),
  }),
  body: z
    .object({
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

const emailSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .max(100, "Email must be less than 100 characters")
      .trim()
      .toLowerCase()
      .pipe(z.email()),
  }),
});

const tokenSchema = z.object({
  query: z.object({
    token: z.string().min(1, "Token is required"),
  }),
});

const companyIdParamsSchema = z.object({
  params: z.object({
    companyId: z.uuid("Company ID must be a valid UUID"),
  }),
});

const createSyncSourceSchema = companyIdParamsSchema.extend({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Source name must be at least 2 characters")
      .max(100, "Source name must be 100 characters or fewer")
      .default("Primary accounting source"),
  }),
});

const syncCompaniesSchema = z.object({
  body: z
    .object({
      companies: z
        .array(
          z
            .object({
              externalCompanyId: z
                .string()
                .trim()
                .min(1, "External company ID is required")
                .max(
                  200,
                  "External company ID must be 200 characters or fewer",
                ),
              name: z
                .string()
                .trim()
                .min(1, "Company name is required")
                .max(255, "Company name must be 255 characters or fewer"),
            })
            .strict(),
        )
        .min(1, "At least one accounting company is required")
        .max(100, "A maximum of 100 accounting companies is allowed"),
    })
    //checking for duplicate external id,
    // since external id is unique.
    .superRefine(({ companies }, context) => {
      const seen = new Set();
      companies.forEach((company, index) => {
        if (seen.has(company.externalCompanyId)) {
          context.addIssue({
            code: "custom",
            path: ["companies", index, "externalCompanyId"],
            message: "External company IDs must be unique",
          });
        }
        seen.add(company.externalCompanyId);
      });
    }),
});

const externalRecordIdSchema = (label) =>
  z
    .union([z.string(), z.number().int().safe()])
    .transform((value) => String(value).trim())
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .max(100, `${label} must be 100 characters or fewer`),
    );

const nullableTextSchema = (maximum) =>
  z.preprocess(
    (value) =>
      value === undefined || value === null || value === "" ? null : value,
    z.string().trim().max(maximum).nullable(),
  );

const decimalSchema = z.union([
  z.number().finite(),
  z
    .string()
    .trim()
    .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/, "Value must be a valid number"),
]);

const nullableDecimalSchema = z.preprocess(
  (value) =>
    value === undefined || value === null || value === "" ? null : value,
  decimalSchema.nullable(),
);

const nullableDateSchema = z.preprocess(
  (value) =>
    value === undefined || value === null || value === "" ? null : value,
  z.coerce.date().nullable(),
);

const financialYearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "Financial year must use YYYY-YYYY format")
  .refine((value) => {
    const [fromYear, toYear] = value.split("-").map(Number);
    return toYear === fromYear + 1;
  }, "Financial year must contain consecutive years")
  .default("2025-2026");

const accountingCompanyIdsSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    const values = Array.isArray(value) ? value : [value];
    return values
      .flatMap((entry) => String(entry || "").split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  },
  z
    .array(z.uuid("Accounting company ID must be a valid UUID"))
    .max(100, "A maximum of 100 accounting companies can be selected")
    .optional(),
);

const reportPeriodSchema = z.object({
  query: z
    .object({
      financialYear: financialYearSchema,
      accountingCompanyIds: accountingCompanyIdsSchema,
    })
    .passthrough(),
});

const billItemSchema = z
  .object({
    entryId: externalRecordIdSchema("Item entry ID").nullable().optional(),
    serial: nullableTextSchema(50),
    itemCode: nullableTextSchema(100),
    itemName: nullableTextSchema(255),
    category: nullableTextSchema(255),
    group: nullableTextSchema(255),
    brand: nullableTextSchema(255),
    quality: nullableTextSchema(255),
    design: nullableTextSchema(255),
    colour: nullableTextSchema(255),
    pattern: nullableTextSchema(255),
    pcs: nullableDecimalSchema,
    meters: nullableDecimalSchema,
    quantity: nullableDecimalSchema,
    weight: nullableDecimalSchema,
    per: nullableTextSchema(100),
    discountPercent: nullableDecimalSchema,
    discount: nullableDecimalSchema,
    rate: nullableDecimalSchema,
    amount: nullableDecimalSchema,
    taxable: nullableDecimalSchema,
    finalAmount: nullableDecimalSchema,
    cgstRate: nullableDecimalSchema,
    cgstAmount: nullableDecimalSchema,
    sgstRate: nullableDecimalSchema,
    sgstAmount: nullableDecimalSchema,
    igstRate: nullableDecimalSchema,
    igstAmount: nullableDecimalSchema,
    cessRate: nullableDecimalSchema,
    cessAmount: nullableDecimalSchema,
    remarks: nullableTextSchema(10_000),
  })
  .strict();

const billSchema = z
  .object({
    financialYear: financialYearSchema,
    isOpening: z.boolean().default(false),
    entryId: externalRecordIdSchema("Entry ID"),
    compNo: externalRecordIdSchema("Company number"),
    code: nullableTextSchema(50),
    book: nullableTextSchema(100),
    billNo: nullableTextSchema(100),
    date: nullableDateSchema,
    party: nullableTextSchema(255),
    partyCode: nullableTextSchema(100),
    agent: nullableTextSchema(255),
    grossAmount: nullableDecimalSchema,
    netAmount: nullableDecimalSchema,
    cgst: nullableDecimalSchema,
    sgst: nullableDecimalSchema,
    igst: nullableDecimalSchema,
    entryDate: nullableDateSchema,
    modifyDate: nullableDateSchema,
    modifyTime: nullableTextSchema(50),
    items: z.array(billItemSchema).max(1_000).default([]),
  })
  .strict();

const paymentAllocationSchema = z
  .object({
    entryId: externalRecordIdSchema("Allocation entry ID")
      .nullable()
      .optional(),
    code: nullableTextSchema(100),
    billNo: nullableTextSchema(100),
    date: nullableDateSchema,
    mode: nullableTextSchema(100),
    billAmt: nullableDecimalSchema,
    adjustAmt: nullableDecimalSchema,
    unAdjAmt: nullableDecimalSchema,
    bAlAmt: nullableDecimalSchema,
    status: nullableTextSchema(100),
  })
  .strict();

const paymentVoucherSchema = z
  .object({
    financialYear: financialYearSchema,
    isOpening: z.boolean().default(false),
    entryId: externalRecordIdSchema("Entry ID"),
    compNo: externalRecordIdSchema("Company number"),
    date: nullableDateSchema,
    mode: nullableTextSchema(100),
    vchrType: nullableTextSchema(100),
    slipNo: nullableTextSchema(100),
    refNo: nullableTextSchema(100),
    party: nullableTextSchema(255),
    chequeNo: nullableTextSchema(100),
    chequeDate: nullableDateSchema,
    chequeBank: nullableTextSchema(255),
    clearingDate: nullableDateSchema,
    netAmount: nullableDecimalSchema,
    remarks: nullableTextSchema(10_000),
    modifyDate: nullableDateSchema,
    modifyTime: nullableTextSchema(50),
    items: z.array(paymentAllocationSchema).max(1_000).default([]),
  })
  .strict();

function synchronizedRecordBatchSchema(recordSchema, recordLabel) {
  return z.object({
    body: z
      .array(recordSchema)
      .min(1, `At least one ${recordLabel} is required`)
      .max(500, `A maximum of 500 ${recordLabel}s is allowed per request`)
      .superRefine((records, context) => {
        const seen = new Set();

        records.forEach((record, index) => {
          const key = `${record.financialYear}\u0000${record.compNo}\u0000${record.entryId}`;
          if (seen.has(key)) {
            context.addIssue({
              code: "custom",
              path: [index, "entryId"],
              message: `Duplicate ${recordLabel} for this company number`,
            });
          }
          seen.add(key);
        });
      }),
  });
}

const syncBillsSchema = synchronizedRecordBatchSchema(billSchema, "bill");
const syncVouchersSchema = synchronizedRecordBatchSchema(
  paymentVoucherSchema,
  "voucher",
);

const partyDetailsSchema = z.object({
  query: z.object({
    financialYear: financialYearSchema,
    party: z
      .string({ error: "Party is required" })
      .trim()
      .min(1, "Party is required")
      .max(255, "Party must be 255 characters or fewer")
      .transform((party) => party.toUpperCase()),
  }),
});

const itemDetailsSchema = z.object({
  query: z.object({
    financialYear: financialYearSchema,
    item: z
      .string({ error: "Item is required" })
      .trim()
      .min(1, "Item is required")
      .max(255, "Item must be 255 characters or fewer")
      .transform((item) => item.toUpperCase()),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  emailSchema,
  passwordResetSchema,
  tokenSchema,
  companyIdParamsSchema,
  createSyncSourceSchema,
  syncCompaniesSchema,
  syncBillsSchema,
  syncVouchersSchema,
  reportPeriodSchema,
  partyDetailsSchema,
  itemDetailsSchema,
};

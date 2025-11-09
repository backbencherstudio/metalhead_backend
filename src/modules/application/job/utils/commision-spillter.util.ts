export const commisionSpillter = (baseAmount: number) => {
  const baseAmountCents = Math.round(baseAmount * 100);
  const adminFeePercent = Number(process.env.ADMIN_FEE ?? 0);
  const adminFeeCents = Math.round(baseAmountCents * adminFeePercent);
  const totalAmountCents = baseAmountCents + adminFeeCents;
  const helperAmountCents = baseAmountCents - adminFeeCents;

  return {
    baseAmount: baseAmountCents / 100,
    baseAmountCents,
    totalAmount: totalAmountCents / 100,
    totalAmountCents,
    adminFee: adminFeeCents / 100,
    adminFeeCents,
    helperAmount: helperAmountCents / 100,
    helperAmountCents,
  };
};
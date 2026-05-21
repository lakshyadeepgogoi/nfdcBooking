export const formatINR = (amount) =>
  "₹" + Number(amount).toLocaleString("en-IN")

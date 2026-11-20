import { PaymentReturn } from "@/components/payment-return";
export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  return <PaymentReturn orderId={typeof orderId === "string" ? orderId : ""} />;
}

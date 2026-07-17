import { useLocalSearchParams } from "expo-router";

import { ExpenseForm } from "@/components/ExpenseForm";

/** Edit route — same form, prefilled. */
export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseForm expenseId={id} />;
}

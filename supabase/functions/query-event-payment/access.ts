// Who may poll (and so potentially mark as failed) an event registration.
//
// The caller must always present the transaction_id that register-event
// returned for that registration. Rows owned by an account additionally
// require that account's JWT; guest rows (user_id = null) rely on the
// transaction_id alone, since only the browser that started the payment has it.
export function authorisePoll(params: {
  leadUserId: string | null;
  leadPaymentReference: string | null;
  callerUserId: string | null;
  transactionId: string;
}): 'ok' | 'forbidden' {
  const { leadUserId, leadPaymentReference, callerUserId, transactionId } = params;
  if (!transactionId || !leadPaymentReference || transactionId !== leadPaymentReference) return 'forbidden';
  if (leadUserId !== null && leadUserId !== callerUserId) return 'forbidden';
  return 'ok';
}

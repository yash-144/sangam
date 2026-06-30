export function parseError(raw: string): string {
  if (raw.includes("deposit phase not complete")) return "Not everyone has deposited yet. Please wait.";
  if (raw.includes("already joined")) return "You have already joined this circle.";
  if (raw.includes("slots are full")) return "This circle is already full.";
  if (raw.includes("fund state is not Pending")) return "This circle is no longer accepting members.";
  if (raw.includes("only organizer can activate")) return "Only the organiser can start the fund.";
  if (raw.includes("slots are not full")) return "Waiting for all members to join.";
  if (raw.includes("already committed") || raw.includes("commitment.is_some")) return "You have already sealed your draw for this round.";
  if (raw.includes("already deposited") || raw.includes("has_deposited")) return "You have already paid your share this round.";
  if (raw.includes("reveal phase not complete")) return "Not everyone has revealed yet.";
  return raw;
}

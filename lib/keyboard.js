export function generateTicketGrid(round, takenNumbers) {
  const keyboard = [];
  let row = [];
  const maxTickets = round.maxTickets;

  for (let i = 1; i <= maxTickets; i++) {
    const isTaken = takenNumbers.has(i);
    row.push({
      text: isTaken ? '❌' : `${i}`,
      callback_data: isTaken ? `ticket:taken:${i}` : `ticket:buy:${round.id}:${i}`
    });

    if (row.length === 5) {
      keyboard.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    keyboard.push(row);
  }
  return { inline_keyboard: keyboard };
}

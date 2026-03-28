-- Remove mock/sample support tickets that have no user_id (not created by real patients)
DELETE FROM support_ticket_messages
  WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id IS NULL);

DELETE FROM support_tickets WHERE user_id IS NULL;

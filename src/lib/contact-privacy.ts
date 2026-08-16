import "server-only";

import { isCrmDemoMode } from "./demo";
import { createAdminClient } from "./supabase/admin";

export type ContactPrivacyState = {
  suppressed: boolean;
  reason?: string;
  suppressedAt?: string;
  unsubscribedAt?: string;
};

export async function getContactPrivacyState(contactId: string): Promise<ContactPrivacyState | null> {
  if (isCrmDemoMode()) return { suppressed: false };
  const { data, error } = await createAdminClient()
    .from("contacts")
    .select("email_suppressed_at, email_suppression_reason, unsubscribed_at")
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(`Could not read contact privacy state: ${error.message}`);
  if (!data) return null;
  return {
    suppressed: Boolean(data.email_suppressed_at || data.unsubscribed_at),
    reason: data.email_suppression_reason ?? undefined,
    suppressedAt: data.email_suppressed_at ?? undefined,
    unsubscribedAt: data.unsubscribed_at ?? undefined,
  };
}

export async function exportContactData(contactId: string) {
  const { data, error } = await createAdminClient().rpc("export_crm_contact_v1", { p_contact_id: contactId });
  if (error) throw new Error(`Could not export contact data: ${error.message}`);
  return data;
}

export async function setContactSuppression(contactId: string, suppressed: boolean) {
  const { data, error } = await createAdminClient().rpc("set_crm_contact_suppression_v1", {
    p_contact_id: contactId,
    p_suppressed: suppressed,
  });
  if (error) throw new Error(`Could not update email suppression: ${error.message}`);
  return data;
}

export async function purgeContact(contactId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("purge_crm_contact_v1", { p_contact_id: contactId });
  if (error) throw new Error(`Could not permanently delete contact: ${error.message}`);
  return data === true;
}

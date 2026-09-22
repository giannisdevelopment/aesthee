/**
 * Fire-and-forget appointment emails (Resend via /api/send-appointment-email).
 * Never blocks the UI — failures are logged only.
 */

/**
 * @param {{
 *   type: "created" | "confirmed" | "rescheduled" | "cancelled" | "updated",
 *   email?: string | null,
 *   appointment: Record<string, unknown>,
 *   previousDate?: string | null,
 *   previousTime?: string | null,
 * }} opts
 */
export async function notifyAppointmentEmail(opts) {
  const email = String(opts.email || opts.appointment?.guest_email || "").trim();
  if (!email || !email.includes("@")) return { skipped: true, reason: "no_email" };

  try {
    const response = await fetch("/api/send-appointment-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: opts.type,
        email,
        appointment: {
          guest_name: opts.appointment.guest_name,
          guest_email: email,
          service: opts.appointment.service,
          appointment_date: opts.appointment.appointment_date,
          appointment_time: opts.appointment.appointment_time,
          duration_minutes: opts.appointment.duration_minutes,
          price_cents: opts.appointment.price_cents,
          cabin_id: opts.appointment.cabin_id,
          status: opts.appointment.status,
        },
        previousDate: opts.previousDate || null,
        previousTime: opts.previousTime || null,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn("appointment email", err);
      return { ok: false, error: err.error || response.statusText };
    }
    return { ok: true };
  } catch (error) {
    console.warn("appointment email", error);
    return { ok: false, error: error.message };
  }
}

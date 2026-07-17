import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private client: BrevoClient | null = null;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    this.senderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL') || '';
    this.senderName = this.configService.get<string>('BREVO_SENDER_NAME') || 'Academic Affairs';

    if (apiKey) {
      this.client = new BrevoClient({ apiKey });
      this.logger.log('Brevo email service initialized successfully.');
    } else {
      this.logger.warn('BREVO_API_KEY is not set. Emails will be simulated in logs only.');
    }
  }

  /**
   * Sends a welcome email to a newly created user account.
   * Contains their login email and NIC-based temporary password.
   */
  async sendWelcomeEmail(
    recipientEmail: string,
    recipientName: string,
    temporaryPassword: string,
  ): Promise<void> {
    const subject = 'Your Academic Portal Account Has Been Created';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f172a, #1e3a5f); padding: 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { color: #94a3b8; margin: 8px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .text { color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .credentials-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .value { font-size: 15px; font-weight: 600; color: #0f172a; font-family: monospace; word-break: break-all; }
    .divider { border-top: 1px solid #e2e8f0; margin: 14px 0; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .warning strong { display: block; margin-bottom: 4px; }
    .footer { padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>METROPOLITAN UNIVERSITY OF TECHNOLOGY</h1>
      <p>Office of Academic Affairs and Examinations</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${recipientName},</div>
      <p class="text">
        Your student portal account has been successfully created. You can now access the academic portal
        to register for courses, view examination schedules, and track your academic results.
      </p>
      <p class="text"><strong>Your login credentials are as follows:</strong></p>
      <div class="credentials-box">
        <div class="label">Email Address (Username)</div>
        <div class="value">${recipientEmail}</div>
        <div class="divider"></div>
        <div class="label">Temporary Password (Your NIC Number)</div>
        <div class="value">${temporaryPassword}</div>
      </div>
      <div class="warning">
        <strong>⚠ Action Required: Change Your Password</strong>
        Your temporary password is your NIC number. For the security of your account, you will be prompted
        to change it the first time you log in. Please keep your credentials strictly confidential.
      </div>
      <p class="text">
        If you did not expect this email or believe it was sent in error,
        please contact the Examinations Division immediately.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Metropolitan University of Technology &mdash; Examinations Division
    </div>
  </div>
</body>
</html>
    `.trim();

    if (!this.client) {
      this.logger.log(
        `[SIMULATED EMAIL] Welcome email → ${recipientEmail} (${recipientName}) | Temp password: ${temporaryPassword}`,
      );
      return;
    }

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject,
        htmlContent,
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: recipientEmail, name: recipientName }],
      });
      this.logger.log(`Welcome email sent successfully to ${recipientEmail}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send welcome email to ${recipientEmail}: ${msg}`);
      // Non-fatal — user was still created successfully
    }
  }

  /**
   * Notifies students when their academic results have been published.
   */
  async sendResultsPublishedNotifications(academicYear: number, semester: string): Promise<void> {
    try {
      const students = await this.prisma.student.findMany({
        where: { academic_year: academicYear },
        include: { user: true },
      });

      this.logger.log(
        `Sending results published notifications to ${students.length} students (Year ${academicYear}, Sem ${semester})...`,
      );

      for (const student of students) {
        if (!student.user) continue;
        const { email, full_name } = student.user;

        if (!this.client) {
          this.logger.log(`[SIMULATED EMAIL] Results notification → ${email}`);
          continue;
        }

        try {
          await this.client.transactionalEmails.sendTransacEmail({
            subject: `Academic Results Published — Semester ${semester}`,
            htmlContent: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                <h2 style="color:#0f172a;">Results Published</h2>
                <p>Dear <strong>${full_name}</strong>,</p>
                <p>Your academic results for <strong>Academic Year ${academicYear} — Semester ${semester}</strong>
                have been compiled and published. Please log in to the portal to view your grade sheets and GPA summary.</p>
                <p style="color:#64748b;font-size:13px;">Metropolitan University of Technology — Examinations Division</p>
              </div>
            `.trim(),
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email, name: full_name }],
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to send results notification to ${email}: ${msg}`);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send results published notifications: ${msg}`);
    }
  }

  /**
   * Notifies students when the course registration window opens.
   */
  async sendRegistrationOpenedNotifications(
    academicYear: number,
    semester: string,
    endDate: Date,
  ): Promise<void> {
    try {
      const students = await this.prisma.student.findMany({
        where: { academic_year: academicYear },
        include: { user: true },
      });

      const formattedDate = endDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      this.logger.log(
        `Sending registration window notifications to ${students.length} students (Year ${academicYear}, Sem ${semester})...`,
      );

      for (const student of students) {
        if (!student.user) continue;
        const { email, full_name } = student.user;

        if (!this.client) {
          this.logger.log(`[SIMULATED EMAIL] Registration notification → ${email}`);
          continue;
        }

        try {
          await this.client.transactionalEmails.sendTransacEmail({
            subject: `Course Registration Window Open — Semester ${semester}`,
            htmlContent: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                <h2 style="color:#0f172a;">Registration Window Open</h2>
                <p>Dear <strong>${full_name}</strong>,</p>
                <p>The course registration window for <strong>Academic Year ${academicYear} — Semester ${semester}</strong>
                is now <strong style="color:#16a34a;">OPEN</strong>.</p>
                <p>The deadline to complete your registration is <strong>${formattedDate}</strong>.
                Please log in and register your courses before the deadline.</p>
                <p style="color:#64748b;font-size:13px;">Metropolitan University of Technology — Examinations Division</p>
              </div>
            `.trim(),
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email, name: full_name }],
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to send registration notification to ${email}: ${msg}`);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send registration opened notifications: ${msg}`);
    }
  }
}

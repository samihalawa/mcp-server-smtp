import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { logToFile } from "./index.js";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, "utf-8"));
}

async function writeJson(p: string, data: unknown): Promise<void> {
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

// Define types for configurations
export interface SmtpServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  isDefault: boolean;
}

export interface RateLimitConfig {
  enabled: boolean;
  messagesPerMinute: number;
}

export interface SmtpConfig {
  smtpServers: SmtpServerConfig[];
  rateLimit: RateLimitConfig;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
}

export interface EmailLogEntry {
  timestamp: string;
  smtpConfig: string;
  templateId?: string;
  recipient: string;
  subject: string;
  success: boolean;
  message?: string;
}

// Define paths for configuration and data storage
export const CONFIG_DIR = path.join(os.homedir(), ".smtp-mcp-server");
export const TEMPLATES_DIR = path.join(CONFIG_DIR, "templates");
export const SMTP_CONFIG_FILE = path.join(CONFIG_DIR, "smtp-config.json");
export const LOG_FILE = path.join(CONFIG_DIR, "email-logs.json");

// Default SMTP configuration
export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  smtpServers: [
    {
      id: "example-smtp",
      name: "Example SMTP",
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "username",
        pass: "password",
      },
      isDefault: true,
    },
  ],
  rateLimit: {
    enabled: true,
    messagesPerMinute: 30,
  },
};

// Default email template
export const DEFAULT_TEMPLATE: EmailTemplate = {
  id: "default",
  name: "Default Template",
  subject: "Default Subject",
  body: "Hello {{name}},\n\nThis is a default email template.\n\nBest regards,\nThe Team",
  isDefault: true,
};

// Example business template
export const BUSINESS_TEMPLATE: EmailTemplate = {
  id: "business-outreach",
  name: "Business Outreach",
  subject: "Partnership Opportunity - {{company}}",
  body: `Dear {{name}},

I hope this email finds you well. I'm reaching out to explore potential collaboration opportunities between our organizations.

We've been following {{company}}'s achievements and believe there could be synergies worth exploring.

Would you be available for a brief call to discuss this further? I'd love to learn more about your current initiatives.

Best regards,
{{sender_name}}
{{sender_email}}`,
  isDefault: false,
};

// Example newsletter template
export const NEWSLETTER_TEMPLATE: EmailTemplate = {
  id: "newsletter",
  name: "Monthly Newsletter",
  subject: "{{month}} Newsletter - {{company}}",
  body: `Dear {{name}},

Welcome to our {{month}} newsletter! 

{{main_content}}

We hope you found this update valuable. If you have any questions, please don't hesitate to contact us.

Best regards,
The {{company}} Team
{{contact_email}}`,
  isDefault: false,
};

/**
 * Ensure all necessary directories and config files exist
 */
export async function ensureConfigDirectories(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });

    if (!(await pathExists(SMTP_CONFIG_FILE))) {
      await writeJson(SMTP_CONFIG_FILE, DEFAULT_SMTP_CONFIG);
    }

    const defaultTemplatePath = path.join(TEMPLATES_DIR, "default.json");
    if (!(await pathExists(defaultTemplatePath))) {
      await writeJson(defaultTemplatePath, DEFAULT_TEMPLATE);
    }

    const businessTemplatePath = path.join(
      TEMPLATES_DIR,
      "business-outreach.json",
    );
    if (!(await pathExists(businessTemplatePath))) {
      await writeJson(businessTemplatePath, BUSINESS_TEMPLATE);
    }

    const newsletterTemplatePath = path.join(TEMPLATES_DIR, "newsletter.json");
    if (!(await pathExists(newsletterTemplatePath))) {
      await writeJson(newsletterTemplatePath, NEWSLETTER_TEMPLATE);
    }

    if (!(await pathExists(LOG_FILE))) {
      await writeJson(LOG_FILE, []);
    }
  } catch (error) {
    logToFile(`Error ensuring config directories: ${error}`);
    throw error;
  }
}

/**
 * Get SMTP configurations
 */
export async function getSmtpConfigs(): Promise<SmtpServerConfig[]> {
  try {
    const config = await readJson<SmtpConfig>(SMTP_CONFIG_FILE);
    return config.smtpServers || [];
  } catch (error) {
    logToFile("Error reading SMTP config:");
    return DEFAULT_SMTP_CONFIG.smtpServers;
  }
}

/**
 * Get default SMTP configuration
 */
export async function getDefaultSmtpConfig(): Promise<SmtpServerConfig> {
  const configs = await getSmtpConfigs();
  return (
    configs.find((config) => config.isDefault) ||
    configs[0] ||
    DEFAULT_SMTP_CONFIG.smtpServers[0]
  );
}

/**
 * Save SMTP configurations
 */
export async function saveSmtpConfigs(
  configs: SmtpServerConfig[],
): Promise<boolean> {
  try {
    const currentConfig = await readJson<SmtpConfig>(SMTP_CONFIG_FILE);
    currentConfig.smtpServers = configs;
    await writeJson(SMTP_CONFIG_FILE, currentConfig);
    return true;
  } catch (error) {
    logToFile("Error saving SMTP config:");
    return false;
  }
}

/**
 * Get email templates
 */
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templates: EmailTemplate[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const templatePath = path.join(TEMPLATES_DIR, file);
        const template = await readJson<EmailTemplate>(templatePath);
        templates.push(template);
      }
    }

    return templates;
  } catch (error) {
    logToFile("Error reading email templates:");
    return [DEFAULT_TEMPLATE, BUSINESS_TEMPLATE, NEWSLETTER_TEMPLATE];
  }
}

/**
 * Get default email template
 */
export async function getDefaultEmailTemplate(): Promise<EmailTemplate> {
  const templates = await getEmailTemplates();
  return (
    templates.find((template) => template.isDefault) ||
    templates[0] ||
    DEFAULT_TEMPLATE
  );
}

/**
 * Save email template
 */
export async function saveEmailTemplate(
  template: EmailTemplate,
): Promise<boolean> {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${template.id}.json`);
    await writeJson(templatePath, template);
    return true;
  } catch (error) {
    logToFile("Error saving email template:");
    return false;
  }
}

/**
 * Delete email template
 */
export async function deleteEmailTemplate(
  templateId: string,
): Promise<boolean> {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
    await fs.rm(templatePath, { force: true });
    return true;
  } catch (error) {
    logToFile("Error deleting email template:");
    return false;
  }
}

/**
 * Log email activity
 */
export async function logEmailActivity(entry: EmailLogEntry): Promise<boolean> {
  try {
    let logs: EmailLogEntry[] = [];

    // Read existing logs if file exists
    if (await pathExists(LOG_FILE)) {
      logs = await readJson<EmailLogEntry[]>(LOG_FILE);
    }

    logs.push(entry);
    await writeJson(LOG_FILE, logs);
    return true;
  } catch (error) {
    logToFile("Error logging email activity:");
    return false;
  }
}

/**
 * Get email logs
 */
export async function getEmailLogs(): Promise<EmailLogEntry[]> {
  try {
    if (await pathExists(LOG_FILE)) {
      return await readJson<EmailLogEntry[]>(LOG_FILE);
    }
    return [];
  } catch (error) {
    logToFile("Error reading email logs:");
    return [];
  }
}

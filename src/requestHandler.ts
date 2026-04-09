import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  Tool, 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  getSmtpConfigs,
  saveSmtpConfigs,
  getEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
  SmtpServerConfig,
  EmailTemplate,
  getEmailLogs,
  EmailLogEntry
} from "./config.js";
import {
  sendEmail,
  sendBulkEmails,
  EmailData,
  BulkEmailData,
  EmailRecipient
} from "./emailService.js";
import { logToFile } from "./index.js";

/**
 * Generate a UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Setup request handlers for the MCP server
 */
export async function setupRequestHandlers(
  server: Server,
  tools: Record<string, Tool>,
): Promise<void> {
  // Handle tool listing
  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {
      return {
        tools: Object.values(tools),
      };
    }
  );

  // Handle tool calls
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      const toolName = request.params.name;
      const toolParams = request.params.arguments || {};

      // Check if the tool exists
      if (!tools[toolName]) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      // Execute the tool based on its name
      switch (toolName) {
        case "send-email":
          return await handleSendEmail(toolParams);

        case "send-bulk-emails":
          return await handleSendBulkEmails(toolParams);

        case "get-smtp-configs":
          return await handleGetSmtpConfigs();

        case "add-smtp-config":
          return await handleAddSmtpConfig(toolParams);

        case "update-smtp-config":
          return await handleUpdateSmtpConfig(toolParams);

        case "delete-smtp-config":
          return await handleDeleteSmtpConfig(toolParams);

        case "get-email-templates":
          return await handleGetEmailTemplates();

        case "add-email-template":
          return await handleAddEmailTemplate(toolParams);

        case "update-email-template":
          return await handleUpdateEmailTemplate(toolParams);

        case "delete-email-template":
          return await handleDeleteEmailTemplate(toolParams);

        case "get-email-logs":
          return await handleGetEmailLogs(toolParams);

        default:
          throw new Error(`Tool '${toolName}' exists but no handler is implemented`);
      }
    }
  );
}

/**
 * Handle send-email tool call
 */
async function handleSendEmail(parameters: any) {
  try {
    const to = Array.isArray(parameters.to) ? parameters.to : [parameters.to];

    const emailData: EmailData = {
      to: to,
      subject: parameters.subject,
      body: parameters.body,
      from: parameters.from,
      cc: parameters.cc,
      bcc: parameters.bcc,
      templateId: parameters.templateId,
      templateData: parameters.templateData
    };

    const result = await sendEmail(emailData, parameters.smtpConfigId);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, message: result.message }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleSendEmail:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle send-bulk-emails tool call
 */
async function handleSendBulkEmails(parameters: any) {
  try {
    const bulkEmailData: BulkEmailData = {
      recipients: parameters.recipients,
      subject: parameters.subject,
      body: parameters.body,
      from: parameters.from,
      cc: parameters.cc,
      bcc: parameters.bcc,
      templateId: parameters.templateId,
      templateData: parameters.templateData,
      batchSize: parameters.batchSize,
      delayBetweenBatches: parameters.delayBetweenBatches
    };

    const result = await sendBulkEmails(bulkEmailData, parameters.smtpConfigId);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: result.success, totalSent: result.totalSent, totalFailed: result.totalFailed,
        failures: result.failures, message: result.message
      }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleSendBulkEmails:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: false, totalSent: 0, totalFailed: parameters.recipients?.length || 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle get-smtp-configs tool call
 */
async function handleGetSmtpConfigs() {
  try {
    const configs = await getSmtpConfigs();

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, configs }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleGetSmtpConfigs:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle add-smtp-config tool call
 */
async function handleAddSmtpConfig(parameters: any) {
  try {
    const configs = await getSmtpConfigs();

    const newConfig: SmtpServerConfig = {
      id: generateUUID(),
      name: parameters.name,
      host: parameters.host,
      port: parameters.port,
      secure: parameters.secure ?? false,
      auth: {
        user: parameters.user,
        pass: parameters.pass
      },
      isDefault: parameters.isDefault ?? false
    };

    if (newConfig.isDefault) {
      configs.forEach(config => { config.isDefault = false; });
    }

    configs.push(newConfig);
    await saveSmtpConfigs(configs);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, config: newConfig }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleAddSmtpConfig:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle update-smtp-config tool call
 */
async function handleUpdateSmtpConfig(parameters: any) {
  try {
    const configs = await getSmtpConfigs();
    const configIndex = configs.findIndex(config => config.id === parameters.id);

    if (configIndex === -1) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: `SMTP configuration with ID ${parameters.id} not found` }, null, 2) }],
        isError: true
      };
    }

    const updatedConfig = { ...configs[configIndex] };

    if (parameters.name !== undefined) updatedConfig.name = parameters.name;
    if (parameters.host !== undefined) updatedConfig.host = parameters.host;
    if (parameters.port !== undefined) updatedConfig.port = parameters.port;
    if (parameters.secure !== undefined) updatedConfig.secure = parameters.secure;
    if (parameters.user !== undefined) updatedConfig.auth.user = parameters.user;
    if (parameters.pass !== undefined) updatedConfig.auth.pass = parameters.pass;

    if (parameters.isDefault !== undefined) {
      updatedConfig.isDefault = parameters.isDefault;
      if (updatedConfig.isDefault) {
        configs.forEach((config, index) => {
          if (index !== configIndex) config.isDefault = false;
        });
      }
    }

    configs[configIndex] = updatedConfig;
    await saveSmtpConfigs(configs);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, config: updatedConfig }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleUpdateSmtpConfig:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle delete-smtp-config tool call
 */
async function handleDeleteSmtpConfig(parameters: any) {
  try {
    const configs = await getSmtpConfigs();
    const configIndex = configs.findIndex(config => config.id === parameters.id);

    if (configIndex === -1) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: `SMTP configuration with ID ${parameters.id} not found` }, null, 2) }],
        isError: true
      };
    }

    if (configs.length === 1) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: 'Cannot delete the only SMTP configuration' }, null, 2) }],
        isError: true
      };
    }

    const isDefault = configs[configIndex].isDefault;
    configs.splice(configIndex, 1);

    if (isDefault && configs.length > 0) {
      configs[0].isDefault = true;
    }

    await saveSmtpConfigs(configs);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: 'SMTP configuration deleted successfully' }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleDeleteSmtpConfig:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle get-email-templates tool call
 */
async function handleGetEmailTemplates() {
  try {
    const templates = await getEmailTemplates();

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, templates }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleGetEmailTemplates:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle add-email-template tool call
 */
async function handleAddEmailTemplate(parameters: any) {
  try {
    const templates = await getEmailTemplates();

    const newTemplate: EmailTemplate = {
      id: generateUUID(),
      name: parameters.name,
      subject: parameters.subject,
      body: parameters.body,
      isDefault: parameters.isDefault ?? false
    };

    if (newTemplate.isDefault) {
      templates.forEach(template => {
        if (template.isDefault) {
          template.isDefault = false;
          saveEmailTemplate(template).catch(err => {
            logToFile('Error updating template:');
            logToFile(err instanceof Error ? err.message : 'Unknown error');
          });
        }
      });
    }

    await saveEmailTemplate(newTemplate);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, template: newTemplate }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleAddEmailTemplate:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle update-email-template tool call
 */
async function handleUpdateEmailTemplate(parameters: any) {
  try {
    const templates = await getEmailTemplates();
    const template = templates.find(t => t.id === parameters.id);

    if (!template) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: `Email template with ID ${parameters.id} not found` }, null, 2) }],
        isError: true
      };
    }

    const updatedTemplate = { ...template };

    if (parameters.name !== undefined) updatedTemplate.name = parameters.name;
    if (parameters.subject !== undefined) updatedTemplate.subject = parameters.subject;
    if (parameters.body !== undefined) updatedTemplate.body = parameters.body;

    if (parameters.isDefault !== undefined && parameters.isDefault !== template.isDefault) {
      updatedTemplate.isDefault = parameters.isDefault;
      if (updatedTemplate.isDefault) {
        templates.forEach(t => {
          if (t.id !== parameters.id && t.isDefault) {
            t.isDefault = false;
            saveEmailTemplate(t).catch(err => {
              logToFile('Error updating template:');
              logToFile(err instanceof Error ? err.message : 'Unknown error');
            });
          }
        });
      }
    }

    await saveEmailTemplate(updatedTemplate);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, template: updatedTemplate }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleUpdateEmailTemplate:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle delete-email-template tool call
 */
async function handleDeleteEmailTemplate(parameters: any) {
  try {
    const templates = await getEmailTemplates();
    const template = templates.find(t => t.id === parameters.id);

    if (!template) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: `Email template with ID ${parameters.id} not found` }, null, 2) }],
        isError: true
      };
    }

    if (template.isDefault && templates.length > 1) {
      const anotherTemplate = templates.find(t => t.id !== parameters.id);
      if (anotherTemplate) {
        anotherTemplate.isDefault = true;
        await saveEmailTemplate(anotherTemplate);
      }
    }

    await deleteEmailTemplate(parameters.id);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: 'Email template deleted successfully' }, null, 2) }]
    };
  } catch (error) {
    logToFile('Error in handleDeleteEmailTemplate:');
    logToFile(error instanceof Error ? error.message : 'Unknown error');
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle get-email-logs tool call
 */
async function handleGetEmailLogs(parameters: any) {
  try {
    const { limit, filterBySuccess } = parameters as {
      limit?: number;
      filterBySuccess?: boolean;
    };

    let logs = await getEmailLogs();

    if (filterBySuccess !== undefined) {
      logs = logs.filter((log: EmailLogEntry) => log.success === filterBySuccess);
    }

    logs = logs.sort((a: EmailLogEntry, b: EmailLogEntry) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (limit && limit > 0) {
      logs = logs.slice(0, limit);
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, logs }, null, 2) }]
    };
  } catch (error) {
    logToFile(`Error getting email logs: ${error}`);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Failed to retrieve email logs' }, null, 2) }],
      isError: true
    };
  }
}
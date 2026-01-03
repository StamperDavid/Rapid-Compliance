/**
 * Email HTML Templates - Professional Email Rendering
 * 
 * This module provides HTML wrappers for sales emails with:
 * - Responsive design for mobile and desktop
 * - Professional branding
 * - Consistent formatting
 * - Email client compatibility
 */

/**
 * HTML email options
 */
export interface EmailHTMLOptions {
  body: string; // Email body content (can include HTML)
  subject?: string; // Optional subject for preview
  footer?: {
    companyName?: string;
    address?: string;
    unsubscribeLink?: string;
  };
  branding?: {
    logo?: string; // URL to logo image
    primaryColor?: string; // Brand color (hex)
    companyName?: string;
  };
}

/**
 * Generate professional HTML email
 */
export function generateEmailHTML(options: EmailHTMLOptions): string {
  const primaryColor = options.branding?.primaryColor || '#2563eb';
  const companyName = options.branding?.companyName || 'AI Sales Platform';
  
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${options.subject || 'Email from ' + companyName}</title>
  
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Base styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
    }
    
    /* Container styles */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    
    /* Header styles */
    .email-header {
      padding: 24px 32px;
      background-color: ${primaryColor};
      text-align: center;
    }
    
    .email-logo {
      max-height: 40px;
      width: auto;
    }
    
    .email-company-name {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin: 0;
      padding: 0;
    }
    
    /* Body styles */
    .email-body {
      padding: 32px;
      background-color: #ffffff;
    }
    
    .email-body p {
      margin: 0 0 16px 0;
      line-height: 1.6;
    }
    
    .email-body h1 {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    
    .email-body h2 {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin: 24px 0 12px 0;
      line-height: 1.3;
    }
    
    .email-body h3 {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 20px 0 10px 0;
      line-height: 1.3;
    }
    
    .email-body ul, .email-body ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    
    .email-body li {
      margin: 0 0 8px 0;
    }
    
    .email-body a {
      color: ${primaryColor};
      text-decoration: underline;
    }
    
    .email-body a:hover {
      color: #1e40af;
    }
    
    /* Button styles */
    .email-button {
      display: inline-block;
      padding: 12px 24px;
      background-color: ${primaryColor};
      color: #ffffff !important;
      text-decoration: none !important;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    
    .email-button:hover {
      background-color: #1e40af;
    }
    
    /* Footer styles */
    .email-footer {
      padding: 24px 32px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
    }
    
    .email-footer p {
      margin: 0 0 8px 0;
    }
    
    .email-footer a {
      color: #6b7280;
      text-decoration: underline;
    }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      
      .email-header,
      .email-body,
      .email-footer {
        padding: 20px !important;
      }
      
      .email-body h1 {
        font-size: 22px !important;
      }
      
      .email-body h2 {
        font-size: 18px !important;
      }
      
      .email-body h3 {
        font-size: 16px !important;
      }
    }
  </style>
</head>

<body>
  <div role="article" aria-roledescription="email" aria-label="${options.subject || 'Email'}" lang="en">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
      <tr>
        <td align="center" style="padding: 40px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <tr>
              <td class="email-header">
                ${options.branding?.logo 
                  ? `<img src="${options.branding.logo}" alt="${companyName}" class="email-logo" />` 
                  : `<h1 class="email-company-name">${companyName}</h1>`
                }
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td class="email-body">
                ${options.body}
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td class="email-footer">
                ${options.footer?.companyName ? `
                  <p style="margin-bottom: 8px;"><strong>${options.footer.companyName}</strong></p>
                ` : ''}
                ${options.footer?.address ? `
                  <p style="margin-bottom: 8px;">${options.footer.address}</p>
                ` : ''}
                ${options.footer?.unsubscribeLink ? `
                  <p style="margin-top: 16px;">
                    <a href="${options.footer.unsubscribeLink}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
                  </p>
                ` : ''}
                <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
                  This email was sent from an automated system. Please do not reply directly to this email.
                </p>
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Convert plain text to HTML paragraphs
 */
export function textToHTML(text: string): string {
  return text
    .split('\n\n')
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/**
 * Generate signature HTML
 */
export function generateSignatureHTML(options: {
  name: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
}): string {
  return `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">${options.name}</p>
  ${options.title ? `<p style="margin: 0 0 4px 0; color: #6b7280;">${options.title}</p>` : ''}
  ${options.company ? `<p style="margin: 0 0 8px 0; color: #6b7280;">${options.company}</p>` : ''}
  ${options.phone || options.email || options.website ? `
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      ${options.phone ? `<span>${options.phone}</span>` : ''}
      ${options.phone && (options.email || options.website) ? ' • ' : ''}
      ${options.email ? `<a href="mailto:${options.email}" style="color: #6b7280; text-decoration: underline;">${options.email}</a>` : ''}
      ${options.email && options.website ? ' • ' : ''}
      ${options.website ? `<a href="${options.website}" style="color: #6b7280; text-decoration: underline;">${options.website.replace(/^https?:\/\//, '')}</a>` : ''}
    </p>
  ` : ''}
</div>
  `.trim();
}

/**
 * Generate call-to-action button HTML
 */
export function generateCTAButtonHTML(options: {
  text: string;
  url: string;
  color?: string;
}): string {
  const bgColor = options.color || '#2563eb';
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 24px auto;">
  <tr>
    <td align="center" style="border-radius: 6px; background-color: ${bgColor};">
      <a href="${options.url}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">${options.text}</a>
    </td>
  </tr>
</table>
  `.trim();
}

/**
 * Wrap email body with HTML template
 */
export function wrapEmailBody(
  body: string,
  options?: {
    subject?: string;
    footer?: EmailHTMLOptions['footer'];
    branding?: EmailHTMLOptions['branding'];
  }
): string {
  return generateEmailHTML({
    body,
    subject: options?.subject,
    footer: options?.footer,
    branding: options?.branding,
  });
}

/**
 * Strip HTML tags for plain text version
 */
export function stripHTML(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

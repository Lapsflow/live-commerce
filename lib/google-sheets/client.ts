import { google } from 'googleapis';

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  range?: string; // e.g., 'A1:Z1000'
}

export interface InventoryRow {
  barcode: string;
  productName: string;
  quantity: number;
  location?: string;
}

export class GoogleSheetsClient {
  private sheets;

  constructor(credentials?: {
    client_email?: string;
    private_key?: string;
  }) {
    const creds = credentials || {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getSheetData(config: SheetConfig): Promise<any[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.sheetName}!${config.range || 'A:Z'}`,
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      throw new Error(`Failed to fetch sheet data: ${error.message}`);
    }
  }

  async parseInventoryData(config: SheetConfig): Promise<InventoryRow[]> {
    const rows = await this.getSheetData(config);

    if (rows.length === 0) {
      return [];
    }

    const [headers, ...dataRows] = rows;

    // Map columns based on expected spreadsheet structure
    // Assuming: Column A = Barcode, B = Product Name, C = Quantity, D = Location
    return dataRows
      .filter((row) => row[0]) // Filter out rows without barcode
      .map((row) => ({
        barcode: String(row[0] || '').trim(),
        productName: String(row[1] || '').trim(),
        quantity: parseInt(String(row[2] || '0')) || 0,
        location: row[3] ? String(row[3]).trim() : undefined,
      }));
  }

  async testConnection(config: SheetConfig): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      return !!response.data;
    } catch (error) {
      console.error('Google Sheets connection test failed:', error);
      return false;
    }
  }
}

// Factory function for creating client instances
export function createGoogleSheetsClient(
  credentials?: {
    client_email?: string;
    private_key?: string;
  }
): GoogleSheetsClient {
  return new GoogleSheetsClient(credentials);
}

import axios, { AxiosError } from "axios";
import { env } from "../../config/env";

export interface PrintResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Send print request to POS Printer Service
 * @param receiptData - Formatted receipt text to print
 * @returns Promise that resolves with print result
 */
export async function printReceipt(receiptData: string): Promise<PrintResult> {
  // Always use localhost - POS service runs on same PC as backend
  const printUrl = `${env.posPrinterUrl}/print`;

  try {
    const response = await axios.post<PrintResult>(
      printUrl,
      {
        data: receiptData,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Print-Key": env.posPrinterKey || "dev-key-12345",
        },
        timeout: 5000, // 5 second timeout (reduced for faster response)
      }
    );

    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || "Print job completed successfully",
      };
    } else {
      return {
        success: false,
        message: response.data.message || "Print job failed",
        error: response.data.error,
      };
    }
  } catch (error) {
    // Handle network errors or service unavailable
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<PrintResult>;

      if (
        axiosError.code === "ECONNREFUSED" ||
        axiosError.code === "ETIMEDOUT"
      ) {
        return {
          success: false,
          message: "POS Printer Service unavailable",
          error: `Cannot connect to printer service: ${axiosError.message}`,
        };
      }

      // Handle HTTP errors
      if (axiosError.response) {
        const errorData = axiosError.response.data;
        return {
          success: false,
          message: errorData?.message || "Print request failed",
          error: errorData?.error || axiosError.message,
        };
      }
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: "Print request failed",
      error: errorMessage,
    };
  }
}

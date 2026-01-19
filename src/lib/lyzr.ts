import { safeJsonParse } from "./utils";

export interface LyzrAgentRequest {
  user_id: string;
  agent_id: string;
  session_id: string;
  message: string;
}

export interface LyzrApiResponse {
  response: string;
  session_id?: string;
  [key: string]: unknown;
}

/**
 * Calls the Lyzr Agent API and returns the parsed response.
 * 
 * @param request - The request parameters
 * @returns The parsed JSON response from the agent, or the raw response if not JSON
 */
export async function callLyzrAgent<T = unknown>(
  request: LyzrAgentRequest
): Promise<T> {
  const apiKey = process.env.LYZR_API_KEY;
  
  if (!apiKey) {
    throw new Error("LYZR_API_KEY is not configured");
  }

  const response = await fetch("https://agent-prod.studio.lyzr.ai/v3/inference/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Lyzr API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const apiResponse = await response.json() as LyzrApiResponse;
  
  // The agent response is typically in the 'response' field
  // It may be a JSON string that needs parsing, or already an object
  const agentResponse = apiResponse.response;
  
  if (typeof agentResponse === "string") {
    // Try to parse as JSON using the safe parser
    try {
      return safeJsonParse<T>(agentResponse, "Lyzr agent response");
    } catch (error) {
      // Log the parsing error for debugging
      console.error("Failed to parse Lyzr agent response as JSON:", error);
      console.log("Raw response (first 500 chars):", agentResponse.substring(0, 500));
      
      // If parsing fails, return the raw response wrapped in an object
      return { response: agentResponse } as T;
    }
  }
  
  return agentResponse as T;
}

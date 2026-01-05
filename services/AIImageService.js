// services/AIImageService.js - Fixed Version
import * as ImagePicker from "expo-image-picker";

class AIImageService {
  constructor() {
    this.apiKey =
      process.env.EXPO_PUBLIC_GEMINI_API_KEY || "your-gemini-api-key-here";
    this.endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    
    // Log configuration status on initialization
    this.logConfigurationStatus();
  }

  logConfigurationStatus() {
    console.log("🔧 AIImageService Configuration:");
    console.log("- API Key configured:", this.apiKey !== "your-gemini-api-key-here" ? "✅ Yes" : "❌ No");
    console.log("- Endpoint:", this.endpoint);
    
    if (this.apiKey === "your-gemini-api-key-here") {
      console.warn("⚠️  To enable AI image analysis, set EXPO_PUBLIC_GEMINI_API_KEY in your .env file");
    }
  }

  // Test API connectivity
  async testConnection() {
    try {
      console.log("🧪 Testing Gemini API connection...");
      
      if (!this.apiKey || this.apiKey === "your-gemini-api-key-here") {
        throw new Error("API key not configured");
      }

      // Simple test request without image
      const testBody = {
        contents: [
          {
            parts: [
              {
                text: "Hello, respond with just 'OK' if you can hear me.",
              },
            ],
          },
        ],
      };

      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testBody),
      });

      if (response.ok) {
        console.log("✅ Gemini API connection test successful");
        return true;
      } else {
        console.error("❌ Gemini API connection test failed:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ Gemini API connection test error:", error.message);
      return false;
    }
  }

  // Google Gemini Vision API Analysis
  async analyzeImage(imageData, provider = "gemini") {
    try {
      // Check if API key is configured
      if (!this.apiKey || this.apiKey === "your-gemini-api-key-here") {
        console.error("❌ Gemini API key not configured. Please set EXPO_PUBLIC_GEMINI_API_KEY in your environment.");
        throw new Error("Gemini API key not configured. Please check your .env file or environment variables.");
      }

      console.log("🔍 Starting Gemini image analysis...");
      
      // Validate image data
      if (!imageData || !imageData.base64) {
        throw new Error("Invalid image data - base64 data is required");
      }

      const prompt = `Identify this item and provide a short description in exactly this format:

"[Item name], approximately [X] lbs, [NUMBER] people needed"

Examples:
- "Refrigerator, approximately 300 lbs, 3 people needed"
- "65-inch TV, approximately 65 lbs, 2 people needed"
- "Sectional sofa, approximately 180 lbs, 2 people needed"
- "Moving box, approximately 30 lbs, 1 person needed"

Be concise and specific about the number of people needed (1, 2, 3, etc.).`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageData.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more consistent output
          topK: 32,
          topP: 1,
          maxOutputTokens: 300,
        },
      };

      console.log("📡 Sending request to Gemini API...");
      
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`📊 Gemini API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Gemini API error response:", errorText);
        
        if (response.status === 401) {
          throw new Error("Invalid API key. Please check your Gemini API key configuration.");
        } else if (response.status === 403) {
          throw new Error("API access forbidden. Please check your Gemini API key permissions.");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a few moments.");
        } else {
          throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }
      }

      const data = await response.json();
      console.log("✅ Received response from Gemini API");
      
      // Validate response structure
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        console.error("❌ Invalid response structure:", JSON.stringify(data, null, 2));
        throw new Error("Invalid response from Gemini API");
      }
      
      const description = data.candidates[0].content.parts[0].text;

      const result = {
        description: description.trim(),
        confidence: "high",
        provider: "gemini",
        tokens_used: data.usageMetadata?.totalTokenCount || 0,
      };

      console.log("🎉 Analysis completed successfully:", result.description);
      return result;
    } catch (error) {
      console.error("❌ Error in analyzeImage:", error.message);
      console.error("🔍 Full error:", error);
      throw error; // Don't fallback to mock - throw the actual error
    }
  }

  // Remove mock analysis - using real API only
  getMockAnalysis() {
    // This method is no longer used - real API only
    throw new Error("Mock analysis disabled - configure Gemini API key");
  }

  // Generate categories from description
  generateCategories(description) {
    const categories = [];
    const desc = description.toLowerCase();

    if (
      desc.includes("sofa") ||
      desc.includes("chair") ||
      desc.includes("table") ||
      desc.includes("bed") ||
      desc.includes("mattress") ||
      desc.includes("furniture") ||
      desc.includes("dresser") ||
      desc.includes("bookcase")
    ) {
      categories.push("Furniture");
    }

    if (
      desc.includes("refrigerator") ||
      desc.includes("washer") ||
      desc.includes("dryer") ||
      desc.includes("appliance") ||
      desc.includes("dishwasher") ||
      desc.includes("oven")
    ) {
      categories.push("Appliance");
    }

    if (
      desc.includes("tv") ||
      desc.includes("television") ||
      desc.includes("computer") ||
      desc.includes("electronic") ||
      desc.includes("monitor")
    ) {
      categories.push("Electronics");
    }

    if (
      desc.includes("box") ||
      desc.includes("moving") ||
      desc.includes("container") ||
      desc.includes("cardboard")
    ) {
      categories.push("Boxes/Moving");
    }

    return categories.length > 0 ? categories : ["General Item"];
  }

  // This function is no longer used in the main modal - people count is extracted directly
  estimateHelpRequirements(description) {
    const desc = description.toLowerCase();

    // Try multiple patterns to find people count
    const patterns = [
      /(?:requires?|needs?)\s+(\d+)\s*(?:person|people)/i,
      /(\d+)\s*(?:person|people)\s*(?:required|needed|recommended)/i,
      /(\d+)\s*(?:person|people)\s*(?:for|to)/i,
      /(\d+)[-\s]*(?:person|people)/i,
    ];

    for (const pattern of patterns) {
      const match = desc.match(pattern);
      if (match) {
        const count = parseInt(match[1]);
        if (count > 0 && count <= 10) {
          // Reasonable range
          return {
            helpNeeded: count > 1,
            peopleNeeded: count,
            reason:
              count > 1
                ? `${count} people recommended for safe handling`
                : "Single person can handle",
          };
        }
      }
    }

    // Weight-based estimation as fallback
    const weightMatch = desc.match(/(\d+(?:-\d+)?)\s*(?:lbs?|pounds?)/i);
    if (weightMatch) {
      const weight = parseInt(weightMatch[1].split("-")[0]);
      if (weight > 200) {
        return {
          helpNeeded: true,
          peopleNeeded: 3,
          reason: "3 people recommended due to heavy weight",
        };
      }
      if (weight > 100) {
        return {
          helpNeeded: true,
          peopleNeeded: 2,
          reason: "2 people recommended due to weight",
        };
      }
    }

    // Item-based estimation as final fallback
    if (desc.includes("refrigerator") || desc.includes("fridge")) {
      return {
        helpNeeded: true,
        peopleNeeded: 3,
        reason: "3 people recommended for refrigerators",
      };
    }
    if (desc.includes("sectional") || desc.includes("large sofa")) {
      return {
        helpNeeded: true,
        peopleNeeded: 2,
        reason: "2 people recommended for large furniture",
      };
    }
    if (desc.includes("tv") || desc.includes("television")) {
      return {
        helpNeeded: true,
        peopleNeeded: 2,
        reason: "2 people recommended for TV safety",
      };
    }
    if (desc.includes("washer") || desc.includes("dryer")) {
      return {
        helpNeeded: true,
        peopleNeeded: 2,
        reason: "2 people recommended for appliances",
      };
    }

    return {
      helpNeeded: false,
      peopleNeeded: 1,
      reason: "Single person can handle",
    };
  }
}

export default new AIImageService();

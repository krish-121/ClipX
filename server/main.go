package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

type RequestBody struct {
	TweetURL string `json:"tweetUrl"`
	Start    string `json:"start"`
	End      string `json:"end"`
}

func enableCORS(w http.ResponseWriter) {
	fmt.Println("🔧 Enabling CORS headers...")
	w.Header().Set("Access-Control-Allow-Origin", "*")                   // Allow all origins to access
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS") // Allowed HTTP methods
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")       // Allowed headers
	fmt.Println("✅ CORS headers enabled")
}

func main() {
	fmt.Println("🚀 Starting Video Clipper Server...")

	// No .env file required - using environment variables or defaults
	fmt.Println("✅ Using environment variables or defaults")

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000" // fallback
		fmt.Printf("⚠️  No PORT in environment, using default: %s\n", port)
	} else {
		fmt.Printf("✅ Using PORT from environment: %s\n", port)
	}

	fmt.Printf("🎯 Setting up routes...\n")
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("🏠 Root endpoint called")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "Video Clipper Server is running",
			"endpoints": "Available: /clip (POST), /download/* (GET)",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})
	http.HandleFunc("/clip", Videoclipper)
	fmt.Println("✅ /clip route registered")

	http.HandleFunc("/download/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("📥 Download request received")
		filePath := "download" + strings.TrimPrefix(r.URL.Path, "/download")

		w.Header().Set("Content-Disposition", "attachment; filename="+filePath[strings.LastIndex(filePath, "/")+1:])
		http.ServeFile(w, r, filePath)
	})
	fmt.Println("✅ /download/ route registered")

	fmt.Printf("🌐 Server starting on port %s...\n", port)
	fmt.Printf("🌍 Server will be available at: http://0.0.0.0:%s\n", port)
	fmt.Printf("🔗 Local access: http://localhost:%s\n", port)

	// Test if port is available
	fmt.Printf("🔍 Testing port availability...\n")

	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatalf("❌ Server failed to start: %v", err)
	}
}

func Videoclipper(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("🎬 Video Clipper endpoint called (Method: %s)\n", r.Method)

	baseURL := strings.TrimRight(os.Getenv("BASE_URL"), "/")
	if baseURL == "" {
		port := os.Getenv("PORT")
		if port == "" {
			port = "9000"
		}
		baseURL = "http://localhost:" + port
	}

	enableCORS(w)
	if r.Method == http.MethodOptions {
		fmt.Println("🔄 OPTIONS request received, returning CORS headers")
		return
	}

	if r.Method != "POST" {
		fmt.Printf("❌ Invalid method: %s (only POST supported)\n", r.Method)
		http.Error(w, "Only POST request supported", http.StatusBadRequest)
		return
	}

	fmt.Println("📝 Parsing request body...")
	var body RequestBody

	err := json.NewDecoder(r.Body).Decode(&body)

	if err != nil {
		log.Printf("❌ Error decoding input: %v", err)
		http.Error(w, "error decoding input", http.StatusBadRequest)
		return
	}

	fmt.Printf("📋 Request body parsed successfully\n")

	tweetUrl := body.TweetURL
	tweetUrl = strings.Replace(tweetUrl, "x.com", "twitter.com", 1)

	start := body.Start
	end := body.End
	fmt.Printf("⏰ Start time: %s, End time: %s\n", start, end)

	if tweetUrl == "" {
		fmt.Println("❌ Missing tweet URL in request")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	fmt.Println("📁 Creating download directory...")
	err = os.MkdirAll("download", os.ModePerm)
	if err != nil {
		fmt.Printf("❌ Failed to create download directory: %v\n", err)
		http.Error(w, "Failed to create download directory", http.StatusInternalServerError)
		return
	}
	fmt.Printf("✅ Download directory created/verified\n")

	id := time.Now().Unix()
	fmt.Printf("🆔 Generated unique ID: %d\n", id)

	videoFile := fmt.Sprintf("download/%d.mp4", id)
	clippedFile := fmt.Sprintf("download/clipped_%d.mp4", id)
	fmt.Printf("📹 Video file path: %s\n", videoFile)
	fmt.Printf("✂️  Clipped file path: %s\n", clippedFile)

	fmt.Println("⬇️  Starting video download with yt-dlp...")
	cmd1 := exec.Command("yt-dlp", "-o", videoFile, tweetUrl)

	_, err1 := cmd1.CombinedOutput()
	if err1 != nil {
		log.Println("❌ yt-dlp failed")
		http.Error(w, "Error downloading the video", http.StatusInternalServerError)
		return
	}
	fmt.Println("✅ Video download completed successfully")

	var cmd2 *exec.Cmd

	fmt.Println("✂️  Starting video clipping with ffmpeg...")
	if start == "" && end == "" {
		fmt.Println("📋 No time range specified, copying entire video")
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-c", "copy", clippedFile)

	} else if end == "" {
		fmt.Printf("⏰ Clipping from %s to end\n", start)
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-ss", start, "-c", "copy", clippedFile)
	} else if start == "" {
		fmt.Printf("⏰ Clipping from start to %s\n", end)
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-to", end, "-c", "copy", clippedFile)

	} else {
		fmt.Printf("⏰ Clipping from %s to %s\n", start, end)
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-ss", start, "-to", end, "-c", "copy", clippedFile)

	}

	_, err2 := cmd2.CombinedOutput()
	if err2 != nil {
		log.Println("❌ ffmpeg failed")
		http.Error(w, "Error downloading the video", http.StatusInternalServerError)
		return
	}
	fmt.Println("✅ Video clipping completed successfully")

	link := fmt.Sprintf("%s/%s", baseURL, clippedFile)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	response := map[string]string{"downloadUrl": link}
	json.NewEncoder(w).Encode(response)
	fmt.Println("✅ Response sent successfully")
	fmt.Printf("🎉 Video clipping request completed successfully!\n")
}

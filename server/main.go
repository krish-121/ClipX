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
	w.Header().Set("Access-Control-Allow-Origin", "*")                   // Allow all origins to access
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS") // Allowed HTTP methods
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")       // Allowed headers
}

func main() {
	fmt.Println("🚀 Starting Video Clipper Server...")

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}
	
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "Video Clipper Server is running",
			"endpoints": "Available: /clip (POST), /download/* (GET)",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})
	http.HandleFunc("/clip", Videoclipper)

	http.HandleFunc("/download/", func(w http.ResponseWriter, r *http.Request) {
		filePath := "download" + strings.TrimPrefix(r.URL.Path, "/download")
		
		w.Header().Set("Content-Disposition", "attachment; filename="+filePath[strings.LastIndex(filePath, "/")+1:])
		http.ServeFile(w, r, filePath)
		
		// After serving, delete the file in a goroutine to avoid blocking the response
		go func() {
			time.Sleep(5 * time.Second) // short delay to allow download to begin
			err := os.Remove(filePath)
			if err != nil {
				log.Printf("Failed to delete file %s: %v", filePath, err)
			}
		}()
	})
	
	fmt.Printf("Server running on port %s\n", port)
	
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func Videoclipper(w http.ResponseWriter, r *http.Request) {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:9000"
	}
	
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Only POST request supported", http.StatusBadRequest)
		return
	}

	var body RequestBody
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		log.Printf("Error decoding input: %v", err)
		http.Error(w, "error decoding input", http.StatusBadRequest)
		return
	}

	tweetUrl := body.TweetURL
	tweetUrl = strings.Replace(tweetUrl, "x.com", "twitter.com", 1)
	start := body.Start
	end := body.End

	if tweetUrl == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	err = os.MkdirAll("download", os.ModePerm)
	if err != nil {
		log.Printf("Failed to create download directory: %v", err)
		http.Error(w, "Failed to create download directory", http.StatusInternalServerError)
		return
	}

	id := time.Now().Unix()
	videoFile := fmt.Sprintf("download/%d.mp4", id)
	clippedFile := fmt.Sprintf("download/clipped_%d.mp4", id)

	cmd1 := exec.Command("yt-dlp", "-o", videoFile, tweetUrl)
	err1 := cmd1.Run()
	if err1 != nil {
		log.Printf("yt-dlp failed: %s", err1)
		http.Error(w, "Error downloading the video", http.StatusInternalServerError)
		return
	}

	var cmd2 *exec.Cmd
	if start == "" && end == "" {
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-c", "copy", clippedFile)
	} else if end == "" {
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-ss", start, "-c", "copy", clippedFile)
	} else if start == "" {
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-to", end, "-c", "copy", clippedFile)
	} else {
		cmd2 = exec.Command("ffmpeg", "-i", videoFile, "-ss", start, "-to", end, "-c", "copy", clippedFile)
	}

	err2 := cmd2.Run()
	if err2 != nil {
		log.Printf("ffmpeg failed: %s", err2)
		http.Error(w, "Error processing the video", http.StatusInternalServerError)
		return
	}

	link := fmt.Sprintf("%s/%s", baseURL, clippedFile)
	w.WriteHeader(http.StatusOK)

	err = os.Remove(videoFile)
	if err != nil {
		log.Printf("Failed to remove original video file: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{"downloadUrl": link}
	json.NewEncoder(w).Encode(response)
}
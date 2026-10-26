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

	"github.com/joho/godotenv"
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

	err := godotenv.Load()
	if err != nil {
		log.Print("Error loading .env file")
		return
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000" // fallback
	}

	http.HandleFunc("/clip", Videoclipper)

	http.HandleFunc("/download/", func(w http.ResponseWriter, r *http.Request) {
		filePath := "download" + strings.TrimPrefix(r.URL.Path, "/download")
		w.Header().Set("Content-Disposition", "attachment; filename="+filePath[strings.LastIndex(filePath, "/")+1:])
		http.ServeFile(w, r, filePath)
	})
	http.ListenAndServe(":"+port, nil)
}

func Videoclipper(w http.ResponseWriter, r *http.Request) {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8000	"
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

	os.MkdirAll("download", os.ModePerm)

	id := time.Now().Unix()

	videoFile := fmt.Sprintf("download/%d.mp4", id)

	clippedFile := fmt.Sprintf("download/clipped_%d.mp4", id)

	cmd1 := exec.Command("yt-dlp", "-o", videoFile, tweetUrl)

	if out1, err1 := cmd1.CombinedOutput(); err1 != nil {
		log.Printf("yt-dlp failed: %s\nOutput: %s", err1, string(out1))

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

	if out2, err2 := cmd2.CombinedOutput(); err2 != nil {
		log.Printf("ffmpeg failed: %s\nOutput: %s", err2, string(out2))

		http.Error(w, "Error downloading the video", http.StatusInternalServerError)
		return
	}

	link := fmt.Sprintf("%s/%s", baseURL, clippedFile)

	log.Printf("Returning download link: %s", link)

	w.WriteHeader(http.StatusOK)

	os.Remove(videoFile)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"downloadUrl": link})

}

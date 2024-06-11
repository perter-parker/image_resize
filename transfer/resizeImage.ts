import sharp from "sharp";
import fs from "fs";
import path from "path";
import { SingleBar, Presets } from "cli-progress";

const inputDir = path.join(__dirname, "../moram2/data");
const outputDir = path.join(__dirname, "../resize_moram2");
const logFile = path.join(__dirname, "error_log.txt"); // Path for the log file

const FILE_VOLUME_RESIZE = 600 * 1024; // Resize threshold for large images
const FILE_RESIZE_WIDTH = 500; // Width to resize to if the condition is met

// Ensure the output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Function to append errors to the log file
const logError = (message: string) => {
    fs.appendFileSync(logFile, `${new Date().toISOString()}: ${message}\n`);
};

// Initialize CLI progress bar
const progressBar = new SingleBar(
    {
        format: "|" + "{bar}" + "| {value}/{total} || {percentage}% || time: {duration} sec ",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
    },
    Presets.shades_classic
);

let totalFiles = 0;
let processedFiles = 0;

const processDirectory = (directory: string) => {
    fs.readdir(directory, { withFileTypes: true }, (err, entries) => {
        if (err) {
            logError(`Error reading the directory: ${directory} - ${err.message}`);
            return;
        }

        entries.forEach((entry) => {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                const newDir = path.join(outputDir, path.relative(inputDir, absolutePath));
                fs.mkdirSync(newDir, { recursive: true });
                processDirectory(absolutePath);
            } else if (entry.isFile() && !entry.name.startsWith("thumb-")) {
                totalFiles++;
                resizeAndSaveImage(absolutePath, entry.name.startsWith("thumb-"));
            }
        });

        // Start the progress bar
        if (totalFiles > 0) {
            progressBar.start(totalFiles, 0);
        }
    });
};

const resizeAndSaveImage = (filePath: string, skipProcessing: boolean) => {
    if (skipProcessing) {
        logError(`Skipping processing for thumbnail: ${filePath}`);
        return;
    }

    const outputFilePath = path.join(outputDir, path.relative(inputDir, filePath));

    fs.stat(filePath, async (err, stats) => {
        if (err) {
            logError(`Error getting file stats: ${filePath} - ${err.message}`);
            return;
        }

        if (stats.size > FILE_VOLUME_RESIZE) {
            try {
                const buffer = fs.readFileSync(filePath);
                sharp(buffer)
                    .resize(FILE_RESIZE_WIDTH)
                    .rotate()
                    .toBuffer()
                    .then((buffer) => fs.writeFileSync(outputFilePath, buffer))
                    .catch((err) => {
                        logError(`Failed to process ${filePath}: ${err.message}`);
                        fs.copyFileSync(filePath, outputFilePath);
                    })
                    .finally(() => {
                        processedFiles++;
                        progressBar.update(processedFiles);
                        if (processedFiles === totalFiles) {
                            progressBar.stop();
                        }
                    });
            } catch (error: any) {
                logError(`Error processing file: ${filePath} - ${error.message}`);
            }
        } else {
            // Optionally copy files that do not need resizing
            fs.copyFile(filePath, outputFilePath, (err) => {
                if (err) {
                    logError(`Failed to copy file: ${filePath} - ${err.message}`);
                }
                processedFiles++;
                progressBar.update(processedFiles);
                if (processedFiles === totalFiles) {
                    progressBar.stop();
                }
            });
        }
    });
};

processDirectory(inputDir);

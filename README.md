# BookLibrary
This is a work-in-progress application to display my list of audiobooks.

This project started as a simple request to Gemini to help me extract part of an Excel spreadsheet into a .json file. I didn't give it any further directions/limitations, and it built me an entire web application for managing my list of Audiobooks. So that got me thinking...

## Building a library JSON file

Open [generator.html](generator.html) in a browser and choose the folder containing your MP3 files. The tool reads ID3 metadata and audio duration locally, then downloads a `library.json` file compatible with the dashboard. Each MP3 becomes one record, and its folder-relative path is stored in `bookFile`.

The browser cannot reliably determine audiobook ratings or narrator names from MP3 metadata. Those fields default to empty or zero values and can be edited in the generated JSON when needed.
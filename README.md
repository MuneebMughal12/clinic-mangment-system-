# Clinic Desk

Offline Windows clinic software for physician prescriptions and ultrasound reports.

## Install and first run

Download `ClinicDesk-Setup-0.1.0.exe` from the latest GitHub release and run it on the clinic computer. On first launch, set an admin username and password on that computer. The admin can then create the clinic owner login. Doctor details and the Tahira Memorial Clinic stationery are prefilled for new clinic accounts.

Each computer keeps its own accounts and patient records in `%APPDATA%\clinic-desk`. Installing the software on another computer does not transfer those records. Use the Backup screen to export a backup and restore it on the destination computer when a transfer is required. Keep backup copies on a separate drive.

The installer does not contain `.env`, admin passwords, or patient databases. Existing development installations with a local `.env` continue to use those credentials. New packaged installations create their own local admin login on first run.

## Updates

The installed app checks this repository's GitHub Releases for a newer version. When a download finishes, it offers to restart and install. Patient data remains in the computer's local data folder. Release assets must include the Windows installer and `latest.yml` for update checks to work.

## Development

```powershell
npm ci
Copy-Item .env.example .env
# Set private development admin credentials in .env
npm run dev
```

```powershell
npm test
npm run dist:win
```

Never commit `.env`, SQLite databases, or backup files.

Start all services and open PM2 monitor.
```bash
cd "d:\daima\vscode\learnning" && pm2 start ecosystem.config.cjs && start wt.exe -d "d:\daima\vscode\learnning" pwsh -NoExit -c "pm2 monit"
```

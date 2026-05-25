@AGENTS.md

## PM2 Services

| Port | Name | Type |
|------|------|------|
| 3000 | learnning-3000 | Next.js |

**Terminal Commands:**
```bash
pm2 start ecosystem.config.cjs   # First time
pm2 start all                    # After first time
pm2 stop all / pm2 restart all
pm2 start learnning-3000 / pm2 stop learnning-3000
pm2 logs / pm2 status / pm2 monit
pm2 save                         # Save process list
pm2 resurrect                    # Restore saved list
```

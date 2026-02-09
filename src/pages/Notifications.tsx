import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const severityConfig = {
  info: { icon: Info, className: "text-primary" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  urgent: { icon: AlertCircle, className: "text-urgent" },
  critical: { icon: AlertTriangle, className: "text-critical animate-pulse-urgent" },
};

export default function Notifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="mr-1 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No notifications</p>
            <p className="text-sm text-muted-foreground">Alerts will appear here when payments are due</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const config = severityConfig[notif.severity as keyof typeof severityConfig] ?? severityConfig.info;
            const Icon = config.icon;
            return (
              <Card
                key={notif.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-accent/50",
                  !notif.is_read && "border-primary/20 bg-primary/[0.02]"
                )}
                onClick={() => {
                  if (!notif.is_read) markRead.mutate(notif.id);
                }}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.className)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-medium", !notif.is_read && "font-semibold")}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{notif.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

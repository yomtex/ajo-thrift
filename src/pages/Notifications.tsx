import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, CheckCircle, AlertCircle, Info, Settings, BellRing } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

const Notifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock notifications data - in a real app this would come from the database
  const mockNotifications = [
    {
      id: 1,
      type: 'success',
      title: 'Contribution Successful',
      message: 'Your monthly contribution of ₦10,000 to "Weekly Savers" has been processed.',
      read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
    },
    {
      id: 2,
      type: 'info',
      title: 'Group Payment Due',
      message: 'Your next contribution to "Monthly Investors" is due in 3 days.',
      read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
    },
    {
      id: 3,
      type: 'warning',
      title: 'Verification Pending',
      message: 'Complete your KYC verification to unlock all features.',
      read: true,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    },
    {
      id: 4,
      type: 'info',
      title: 'New Group Invitation',
      message: 'You have been invited to join "Family Savings Circle".',
      read: true,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() // 2 days ago
    }
  ];

  const [notifications] = useState(mockNotifications);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [contributionReminders, setContributionReminders] = useState(true);
  const [groupUpdates, setGroupUpdates] = useState(true);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'success':
        return { label: 'Success', variant: 'default' as const };
      case 'warning':
        return { label: 'Warning', variant: 'secondary' as const };
      case 'error':
        return { label: 'Error', variant: 'destructive' as const };
      default:
        return { label: 'Info', variant: 'outline' as const };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    toast({
      title: "All notifications marked as read",
      description: "Your notification list has been updated.",
    });
  };

  const handleSaveSettings = () => {
    toast({
      title: "Settings saved",
      description: "Your notification preferences have been updated.",
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your thrift group activities
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const typeConfig = getNotificationTypeLabel(notification.type);
                return (
                  <Card 
                    key={notification.id} 
                    className={`transition-colors ${
                      !notification.read ? 'border-primary/50 bg-primary/5' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{notification.title}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant={typeConfig.variant} className="text-xs">
                                {typeConfig.label}
                              </Badge>
                              {!notification.read && (
                                <div className="h-2 w-2 rounded-full bg-primary"></div>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BellRing className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                <p className="text-muted-foreground">
                  You're all caught up! New notifications will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive push notifications in your browser
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Notification Types</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="contribution-reminders">Contribution Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Get reminded about upcoming contributions
                      </p>
                    </div>
                    <Switch
                      id="contribution-reminders"
                      checked={contributionReminders}
                      onCheckedChange={setContributionReminders}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="group-updates">Group Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications about group activities and announcements
                      </p>
                    </div>
                    <Switch
                      id="group-updates"
                      checked={groupUpdates}
                      onCheckedChange={setGroupUpdates}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t">
                <Button onClick={handleSaveSettings}>
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notifications;
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, XCircle } from "lucide-react";

interface GroupJoinRequestsProps {
  groupId: string; // pass the current group's ID
}

interface JoinRequest {
  id: string;
  message: string | null;
  status: string;
  user_id: string;
  created_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

const GroupJoinRequests = ({ groupId }: GroupJoinRequestsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    fetchRequests();
  }, [groupId]);

  const fetchRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("group_join_requests")
      .select("id, message, status, user_id, created_at, profiles(full_name, email)")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to fetch join requests",
        variant: "destructive",
      });
    } else {
      setRequests(data || []);
    }

    setLoading(false);
  };

  const handleApprove = async (requestId: string, requestUserId: string) => {
    const { error } = await supabase
      .from("group_join_requests")
      .update({ status: "approved" })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      });
      return;
    }

    // ✅ Add user to group_members table
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ user_id: requestUserId, group_id: groupId });

    if (memberError) {
      toast({
        title: "Warning",
        description: "Request approved, but failed to add to members table",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Approved",
        description: "User has been added to the group.",
      });
    }

    fetchRequests();
  };

  const handleReject = async (requestId: string) => {
    const { error } = await supabase
      .from("group_join_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request Rejected",
      description: "The user has been notified.",
    });

    fetchRequests();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading requests...</p>;
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending join requests.</p>;
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <Card key={req.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                {req.profiles?.full_name || "Unknown User"}
              </p>
              <p className="text-xs text-muted-foreground">{req.profiles?.email}</p>
              {req.message && (
                <p className="text-sm mt-2 italic">"{req.message}"</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Requested on {new Date(req.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleApprove(req.id, req.user_id)}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(req.id)}
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default GroupJoinRequests;

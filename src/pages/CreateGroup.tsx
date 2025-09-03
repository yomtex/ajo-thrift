import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Users, Calendar, DollarSign, AlertCircle, Clock, Target } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatNumberInput, parseNumberInput } from '@/lib/utils';

const CreateGroup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [helperSuggestions, setHelperSuggestions] = useState<Array<{
    id: string;
    label: string;
    description: string;
    updates: Partial<typeof formData>;
  }>>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    targetAmount: '',
    frequency: '',
    maxParticipants: '',
    startDate: '',
    endDate: ''
  });

  // Check if user is verified
  const { data: verification, isLoading: verificationLoading } = useQuery({
    queryKey: ['verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('verification')
        .select('verification_status')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Calculate number of periods between start and end date based on frequency
  const calculatePeriods = (startDate: string, endDate: string, frequency: string): number => {
    if (!startDate || !endDate || !frequency) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (frequency) {
      case 'daily':
        return diffDays;
      case 'weekly':
        return Math.ceil(diffDays / 7);
      case 'monthly':
        return Math.ceil(diffDays / 30);
      case 'every':
        return 1; // For 'every' frequency, it's just one lump sum
      default:
        return 0;
    }
  };

  // Calculate expected total based on contribution amount and periods
  const calculateExpectedTotal = (): number => {
    const periods = calculatePeriods(formData.startDate, formData.endDate, formData.frequency);
    const contributionAmount = parseNumberInput(formData.contributionAmount);
    const participants = parseInt(formData.maxParticipants) || 1;
    // In thrift: total pool = contribution × periods × participants
    // Each participant gets: total_pool / participants per payout
    return periods * contributionAmount * participants;
  };

  // Calculate what each participant should receive (payout amount)
  const calculatePayoutAmount = (): number => {
    const totalPool = calculateExpectedTotal();
    const participants = parseInt(formData.maxParticipants) || 1;
    return totalPool / participants;
  };

  // Generate helper suggestions when amounts don't match
  const generateSuggestions = () => {
    const payoutAmount = calculatePayoutAmount();
    const targetAmount = parseNumberInput(formData.targetAmount);
    const contributionAmount = parseNumberInput(formData.contributionAmount);
    const periods = calculatePeriods(formData.startDate, formData.endDate, formData.frequency);
    const participants = parseInt(formData.maxParticipants) || 1;
    
    const suggestions = [];

    // Option 1: Adjust target amount to match payout amount (what each participant gets)
    suggestions.push({
      id: 'adjust-target',
      label: 'Adjust Target Amount',
      description: `Set target amount to ${formatCurrency(payoutAmount)} (what each participant receives per payout cycle)`,
      updates: {
        targetAmount: formatNumberInput(Math.round(payoutAmount).toString())
      }
    });

    // Option 2: Adjust contribution amount to match target (per participant)
    if (periods > 0) {
      const requiredTotalPool = targetAmount * participants;
      const newContribution = Math.round(requiredTotalPool / (periods * participants));
      if (newContribution >= 1000) {
        suggestions.push({
          id: 'adjust-contribution',
          label: 'Adjust Contribution Amount',
          description: `Set contribution to ${formatCurrency(newContribution)} per ${formData.frequency === 'every' ? 'lump sum' : formData.frequency} to reach ${formatCurrency(targetAmount)} target`,
          updates: {
            contributionAmount: formatNumberInput(newContribution.toString())
          }
        });
      }
    }

    // Option 3: Adjust date range to match target amount
    if (contributionAmount > 0 && formData.frequency !== 'every') {
      const requiredTotalPool = targetAmount * participants;
      const requiredPeriods = Math.ceil(requiredTotalPool / (contributionAmount * participants));
      
      if (requiredPeriods > 0) {
        const startDate = new Date(formData.startDate);
        const newEndDate = new Date(startDate);
        
        if (formData.frequency === 'daily') {
          newEndDate.setDate(startDate.getDate() + requiredPeriods);
        } else if (formData.frequency === 'weekly') {
          newEndDate.setDate(startDate.getDate() + (requiredPeriods * 7));
        } else if (formData.frequency === 'monthly') {
          newEndDate.setMonth(startDate.getMonth() + requiredPeriods);
        }
        
        suggestions.push({
          id: 'adjust-dates',
          label: 'Adjust Date Range',
          description: `Extend to ${requiredPeriods} ${formData.frequency === 'monthly' ? 'months' : formData.frequency === 'weekly' ? 'weeks' : 'days'} (ending ${newEndDate.toLocaleDateString()}) to reach ${formatCurrency(targetAmount)} target`,
          updates: {
            endDate: newEndDate.toISOString().split('T')[0]
          }
        });
      }
    }

    return suggestions;
  };

  const applySuggestion = (suggestion: typeof helperSuggestions[0]) => {
    setFormData(prev => ({ ...prev, ...suggestion.updates }));
    setShowHelper(false);
    toast({
      title: "Settings Updated",
      description: suggestion.label + " applied successfully",
    });
  };

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: typeof formData) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('thrift_groups')
        .insert({
          name: groupData.name,
          description: groupData.description,
          contribution_amount: parseNumberInput(groupData.contributionAmount),
          target_amount: parseNumberInput(groupData.targetAmount),
          frequency: groupData.frequency as 'daily' | 'weekly' | 'monthly' | 'every',
          max_participants: parseInt(groupData.maxParticipants),
          start_date: groupData.startDate,
          end_date: groupData.endDate,
          creator_id: user.id,
          status: 'recruiting'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Automatically join the creator as the first member
      await supabase
        .from('group_members')
        .insert({
          group_id: data.id,
          user_id: user.id,
          payout_position: 1
        });

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Group Created!",
        description: `"${data.name}" has been created successfully.`,
      });
      setShowPreview(false);
      navigate('/groups');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    }
  });

  const handleInputChange = (field: string, value: string) => {
    if (field === 'contributionAmount' || field === 'targetAmount') {
      // Format contribution and target amounts with commas
      const formatted = formatNumberInput(value);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else if (field === 'maxParticipants') {
      // Only allow digits for participants, no formatting needed
      const numericValue = value.replace(/\D/g, '');
      if (numericValue === '' || (parseInt(numericValue) >= 2 && parseInt(numericValue) <= 50)) {
        setFormData(prev => ({ ...prev, [field]: numericValue }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePreview = () => {
    // Validation for preview
    if (!formData.name || !formData.contributionAmount || !formData.targetAmount || 
        !formData.frequency || !formData.maxParticipants || !formData.startDate || !formData.endDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(formData.maxParticipants) < 2 || parseInt(formData.maxParticipants) > 50) {
      toast({
        title: "Invalid Participants",
        description: "Group must have between 2 and 50 participants",
        variant: "destructive",
      });
      return;
    }

    if (parseNumberInput(formData.contributionAmount) < 1000) {
      toast({
        title: "Invalid Amount",
        description: "Minimum contribution is ₦1,000",
        variant: "destructive",
      });
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast({
        title: "Invalid Date Range",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    // Validate target amount matches expected payout per participant
    const payoutAmount = calculatePayoutAmount();
    const targetAmount = parseNumberInput(formData.targetAmount);
    
    if (Math.abs(payoutAmount - targetAmount) > 0.01) {
      const suggestions = generateSuggestions();
      setHelperSuggestions(suggestions);
      setShowHelper(true);
      return;
    }

    setShowPreview(true);
  };

  const handleSubmit = () => {
    createGroupMutation.mutate(formData);
  };

  if (verificationLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (verification?.verification_status !== 'approved') {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create Thrift Group</h1>
        </div>

        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to complete KYC verification before creating a group. 
                Please verify your BVN first.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => navigate('/verification')}>
                Complete Verification
              </Button>
              <Button variant="ghost" onClick={() => navigate('/groups')}>
                Back to Groups
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Groups
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create Thrift Group</h1>
        <p className="text-muted-foreground">
          Set up a new savings group for your community
        </p>
      </div>

      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Group Details</CardTitle>
            <CardDescription>
              Provide the basic information for your thrift group
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Monthly Savers Circle"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the purpose and goals of your group..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contribution">Contribution Amount (₦) *</Label>
                  <Input
                    id="contribution"
                    type="text"
                    placeholder="10,000"
                    value={formData.contributionAmount}
                    onChange={(e) => handleInputChange('contributionAmount', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: ₦1,000
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target">Target Amount (₦) *</Label>
                  <Input
                    id="target"
                    type="text"
                    placeholder="120,000"
                    value={formData.targetAmount}
                    onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Expected payout: {formData.contributionAmount && formData.startDate && formData.endDate && formData.frequency && formData.maxParticipants
                      ? formatCurrency(calculatePayoutAmount())
                      : '₦0'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select 
                  value={formData.frequency} 
                  onValueChange={(value) => handleInputChange('frequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="every">One-time (Lump sum)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="participants">Maximum Participants *</Label>
                  <Input
                    id="participants"
                    type="text"
                    placeholder="10"
                    value={formData.maxParticipants}
                    onChange={(e) => handleInputChange('maxParticipants', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Between 2 and 50 members
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Once created, some group details cannot be changed. Please review carefully.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  onClick={handlePreview}
                  className="flex-1"
                >
                  Preview Group
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/groups')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Group Preview</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-xl font-semibold">{formData.name}</h4>
              <p className="text-muted-foreground mt-1">
                {formData.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">
                    {formatCurrency(parseNumberInput(formData.contributionAmount))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    per {formData.frequency === 'every' ? 'lump sum' : formData.frequency}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">
                    {formatCurrency(parseNumberInput(formData.targetAmount))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    target amount
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">
                    {formData.maxParticipants} members
                  </div>
                  <div className="text-sm text-muted-foreground">
                    maximum participants
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">
                    {calculatePeriods(formData.startDate, formData.endDate, formData.frequency)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formData.frequency === 'every' ? 'payment' : 'payments'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">
                    {new Date(formData.startDate).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    start date
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">
                    {new Date(formData.endDate).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    end date
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSubmit}
                disabled={createGroupMutation.isPending}
                className="flex-1"
              >
                {createGroupMutation.isPending ? 'Creating Group...' : 'Create Group'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Helper Modal */}
      <Dialog open={showHelper} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Amount Mismatch Detected
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                The target amount doesn't match your expected total based on the contribution amount and date range. 
                Choose from our suggestions below to fix this:
              </p>
            </div>

            <div className="space-y-3">
              {helperSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{suggestion.label}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {suggestion.description}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Apply
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowHelper(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateGroup;
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Upload, Shield, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

const Verification = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bvn, setBvn] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: verification, isLoading } = useQuery({
    queryKey: ['verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('verification')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const verifyBvnMutation = useMutation({
    mutationFn: async (bvnNumber: string) => {
      if (!user?.id) throw new Error('User not found');
      
      // Get current verification to check if document is uploaded
      const { data: currentVerification } = await supabase
        .from('verification')
        .select('kyc_document_url, document_type')
        .eq('user_id', user.id)
        .single();
      
      // Determine status: approved only if both BVN and document are provided
      const hasDocument = currentVerification?.kyc_document_url && currentVerification?.document_type;
      const newStatus = hasDocument ? 'approved' : 'pending';
      
      const updateData: any = { 
        bvn: bvnNumber,
        verification_status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // Add verified_at if both requirements are met
      if (newStatus === 'approved') {
        updateData.verified_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('verification')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { data, isComplete: newStatus === 'approved' };
    },
    onSuccess: ({ data, isComplete }) => {
      toast({
        title: isComplete ? "Verification Complete!" : "BVN Saved",
        description: isComplete 
          ? "Both BVN and document verified. You can now create groups!" 
          : "BVN saved. Please upload a document to complete verification.",
      });
      queryClient.invalidateQueries({ queryKey: ['verification'] });
      setBvn('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save BVN",
        variant: "destructive",
      });
    }
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      if (!user?.id) throw new Error('User not found');
      
      // Create file path with user ID and timestamp
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(filePath);
      
      // Get current verification to check if BVN exists
      const { data: currentVerification } = await supabase
        .from('verification')
        .select('bvn')
        .eq('user_id', user.id)
        .single();
      
      // Determine status: approved only if both BVN and document are provided
      const hasBvn = currentVerification?.bvn;
      const newStatus = hasBvn ? 'approved' : 'pending';
      
      const updateData: any = {
        kyc_document_url: publicUrl,
        document_type: docType,
        verification_status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // Add verified_at if both requirements are met
      if (newStatus === 'approved') {
        updateData.verified_at = new Date().toISOString();
      }
      
      // Update verification record with document info
      const { data, error } = await supabase
        .from('verification')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { data, isComplete: newStatus === 'approved' };
    },
    onSuccess: ({ data, isComplete }) => {
      toast({
        title: isComplete ? "Verification Complete!" : "Document Uploaded",
        description: isComplete 
          ? "Both BVN and document verified. You can now create groups!" 
          : "Document uploaded. Please add your BVN to complete verification.",
      });
      queryClient.invalidateQueries({ queryKey: ['verification'] });
      setSelectedFile(null);
      setDocumentType('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    }
  });

  const handleBvnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bvn.length === 10 && /^\d+$/.test(bvn)) {
      verifyBvnMutation.mutate(bvn);
    } else {
      toast({
        title: "Invalid BVN",
        description: "BVN must be exactly 10 digits",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (images and PDFs)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a JPG, PNG, or PDF file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleDocumentUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !documentType) {
      toast({
        title: "Missing Information",
        description: "Please select both document type and file",
        variant: "destructive",
      });
      return;
    }
    
    uploadDocumentMutation.mutate({ file: selectedFile, docType: documentType });
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'drivers_license':
        return "Driver's License";
      case 'nin':
        return 'National ID (NIN)';
      case 'passport':
        return 'International Passport';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (verification?.verification_status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (verification?.verification_status) {
      case 'approved':
        return 'Verified';
      case 'pending':
        return 'Pending Verification';
      case 'rejected':
        return 'Verification Rejected';
      default:
        return 'Not Verified';
    }
  };

  const getStatusDescription = () => {
    switch (verification?.verification_status) {
      case 'approved':
        return 'Your identity has been successfully verified. You can now access all platform features.';
      case 'pending':
        return 'Your verification is being processed. This usually takes 24-48 hours.';
      case 'rejected':
        return 'Your verification was rejected. Please contact support for assistance.';
      default:
        return 'Complete your KYC verification to access all features and increase your transaction limits.';
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
        <p className="text-muted-foreground">
          Verify your identity to access all AjoFlow features
        </p>
      </div>

      <div className="grid gap-6">
        {/* Verification Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Verification Status
            </CardTitle>
            <CardDescription>
              Current status of your identity verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="font-medium">{getStatusText()}</div>
                <p className="text-sm text-muted-foreground">
                  {getStatusDescription()}
                </p>
              </div>
              
              {/* Progress indicators */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${verification?.bvn ? 'bg-success' : 'bg-muted'}`}></div>
                  <span className={verification?.bvn ? 'text-foreground' : 'text-muted-foreground'}>
                    BVN {verification?.bvn ? 'provided' : 'required'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${verification?.kyc_document_url ? 'bg-success' : 'bg-muted'}`}></div>
                  <span className={verification?.kyc_document_url ? 'text-foreground' : 'text-muted-foreground'}>
                    Document {verification?.kyc_document_url ? 'uploaded' : 'required'}
                  </span>
                </div>
              </div>
              
              {verification?.verification_status === 'approved' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your account is fully verified! You can now create and join thrift groups.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* BVN Verification */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Verification Number (BVN)</CardTitle>
            <CardDescription>
              Enter your 10-digit BVN to verify your identity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBvnSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bvn">BVN Number</Label>
                <Input
                  id="bvn"
                  type="text"
                  placeholder="Enter your 10-digit BVN"
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Your BVN is encrypted and stored securely. We use it only for identity verification.
                </p>
              </div>

              <Button 
                type="submit" 
                disabled={bvn.length !== 10 || verifyBvnMutation.isPending}
                className="w-full"
              >
                {verifyBvnMutation.isPending ? 'Saving BVN...' : 'Save BVN'}
              </Button>
            </form>

            {verification?.bvn && (
              <Alert className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  BVN has been saved successfully.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Upload
            </CardTitle>
            <CardDescription>
              Upload a government-issued ID for additional verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDocumentUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document-type">Document Type</Label>
                <Select 
                  value={documentType} 
                  onValueChange={setDocumentType}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="drivers_license" className="cursor-pointer">Driver's License</SelectItem>
                    <SelectItem value="nin" className="cursor-pointer">National ID (NIN)</SelectItem>
                    <SelectItem value="passport" className="cursor-pointer">International Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-file">Upload Document</Label>
                <Input
                  id="document-file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  disabled={uploadDocumentMutation.isPending}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Accepted formats: JPG, PNG, PDF. Maximum size: 5MB
                </p>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={!selectedFile || !documentType || uploadDocumentMutation.isPending}
                className="w-full"
              >
                {uploadDocumentMutation.isPending ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
            </form>

            {verification?.kyc_document_url && (
              <Alert className="mt-4">
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Document uploaded: {getDocumentTypeLabel(verification.document_type || '')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Verification;
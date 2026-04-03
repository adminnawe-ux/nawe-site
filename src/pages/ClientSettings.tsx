import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Save, User, Upload, Camera, Check } from 'lucide-react';

const DEFAULT_AVATARS = [
  '/avatars/avatar-1.png',
  '/avatars/avatar-2.png',
  '/avatars/avatar-3.png',
  '/avatars/avatar-4.png',
  '/avatars/avatar-5.png',
  '/avatars/avatar-6.png',
];

const TIMEZONES = [
  'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata',
];

const COUNTRIES = [
  'Kenya', 'Nigeria', 'South Africa', 'Uganda', 'Tanzania', 'Ghana',
  'Ethiopia', 'Rwanda', 'United Kingdom', 'United States', 'Canada',
];

const ClientSettings = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    location: '',
    timezone: '',
    avatar_url: '',
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setProfile({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          phone: data.phone ?? '',
          country: data.country ?? '',
          location: data.location ?? '',
          timezone: data.timezone ?? '',
          avatar_url: data.avatar_url ?? '',
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (profile.first_name.length > 50) e.first_name = 'Max 50 characters';
    if (profile.last_name.length > 50) e.last_name = 'Max 50 characters';
    if (profile.phone && !/^\+?[\d\s\-()]{7,20}$/.test(profile.phone)) e.phone = 'Enter a valid phone number (e.g. +254 712 345 678)';
    if (profile.location.length > 100) e.location = 'Max 100 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file (JPG, PNG, etc.)', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Avatar must be under 2MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    // Append cache-buster to force refresh
    const url = `${publicUrl}?t=${Date.now()}`;
    setProfile((p) => ({ ...p, avatar_url: url }));
    toast({ title: 'Photo uploaded', description: 'Remember to save your settings.' });
    setUploading(false);
  };

  const selectDefaultAvatar = (avatarSrc: string) => {
    setProfile((p) => ({ ...p, avatar_url: avatarSrc }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!validate()) {
      toast({ title: 'Please fix errors', description: 'Some fields have invalid values.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profile.first_name.trim() || null,
        last_name: profile.last_name.trim() || null,
        phone: profile.phone.trim() || null,
        country: profile.country || null,
        location: profile.location.trim() || null,
        timezone: profile.timezone || null,
        avatar_url: profile.avatar_url.trim() || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated', description: 'Your settings have been saved.' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-1">My Settings</h1>
          <p className="font-body text-muted-foreground text-sm">Manage your personal information and preferences.</p>
        </div>

        <div className="bg-card rounded-[var(--radius)] border border-border p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          {/* Avatar Section */}
          <div className="space-y-4">
            <Label className="font-ui text-sm">Profile Picture</Label>
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg text-foreground">
                  {profile.first_name || profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`.trim()
                    : 'Your Name'}
                </p>
                <p className="font-ui text-xs text-muted-foreground">{user?.email}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-ui text-xs rounded-full mt-1 gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3 w-3" /> Upload Photo
                </Button>
              </div>
            </div>

            {/* Default avatars */}
            <div className="space-y-2">
              <p className="font-ui text-xs text-muted-foreground">Or choose an avatar:</p>
              <div className="flex gap-3 flex-wrap">
                {DEFAULT_AVATARS.map((av, i) => {
                  const isSelected = profile.avatar_url === av;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectDefaultAvatar(av)}
                      className={`relative h-14 w-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${
                        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <img src={av} alt={`Avatar ${i + 1}`} className="h-full w-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-ui text-sm">First Name</Label>
              <Input
                value={profile.first_name}
                onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
                maxLength={50}
                className={`rounded-full ${errors.first_name ? 'border-destructive' : ''}`}
              />
              {errors.first_name && <p className="font-ui text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.first_name}</p>}
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">Last Name</Label>
              <Input
                value={profile.last_name}
                onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
                maxLength={50}
                className={`rounded-full ${errors.last_name ? 'border-destructive' : ''}`}
              />
              {errors.last_name && <p className="font-ui text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.last_name}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-ui text-sm">Phone Number</Label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+254 7XX XXX XXX"
              className={`rounded-full ${errors.phone ? 'border-destructive' : ''}`}
            />
            {errors.phone && <p className="font-ui text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-ui text-sm">Country</Label>
              <Select value={profile.country} onValueChange={(v) => setProfile((p) => ({ ...p, country: v }))}>
                <SelectTrigger className="rounded-full"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">City / Location</Label>
              <Input
                value={profile.location}
                onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Nairobi"
                className="rounded-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-ui text-sm">Timezone</Label>
            <Select value={profile.timezone} onValueChange={(v) => setProfile((p) => ({ ...p, timezone: v }))}>
              <SelectTrigger className="rounded-full"><SelectValue placeholder="Select timezone" /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="font-ui rounded-full w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientSettings;

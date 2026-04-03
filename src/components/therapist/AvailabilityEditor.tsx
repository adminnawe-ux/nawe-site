import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Clock, AlertCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 7; // 07:00 to 20:30
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

type Slot = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  isNew?: boolean;
};

interface Props {
  therapistId: string;
}

const AvailabilityEditor = ({ therapistId }: Props) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', therapistId)
        .order('day_of_week')
        .order('start_time');
      setSlots((data ?? []).map((s) => ({
        id: s.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active,
      })));
      setLoading(false);
    };
    load();
  }, [therapistId]);

  const addSlot = (dayIndex: number) => {
    setSlots((prev) => [
      ...prev,
      { day_of_week: dayIndex, start_time: '09:00', end_time: '17:00', is_active: true, isNew: true },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof Slot, value: string | boolean) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete all existing, then re-insert (simplest approach that won't affect booked sessions)
    await supabase.from('therapist_availability').delete().eq('therapist_id', therapistId);

    if (slots.length > 0) {
      const rows = slots.map((s) => ({
        therapist_id: therapistId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active,
      }));

      const { error } = await supabase.from('therapist_availability').insert(rows);
      if (error) {
        toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    }

    // Reload to get IDs
    const { data } = await supabase
      .from('therapist_availability')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('day_of_week')
      .order('start_time');
    setSlots((data ?? []).map((s) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_active: s.is_active,
    })));

    toast({ title: 'Availability saved', description: 'Your schedule has been updated. Existing bookings are unaffected.' });
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading availability…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="font-body text-xs text-muted-foreground leading-relaxed">
          Set the days and hours you're available for sessions. Changing your availability won't affect already-booked sessions.
        </p>
      </div>

      {DAYS.map((day, dayIndex) => {
        const daySlots = slots
          .map((s, i) => ({ ...s, _index: i }))
          .filter((s) => s.day_of_week === dayIndex);

        return (
          <div key={day} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-ui text-sm font-medium text-foreground">{day}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="font-ui text-xs rounded-full h-7"
                onClick={() => addSlot(dayIndex)}
              >
                <Plus className="h-3 w-3 mr-1" /> Add slot
              </Button>
            </div>

            {daySlots.length === 0 ? (
              <p className="font-ui text-xs text-muted-foreground pl-1">Not available</p>
            ) : (
              <div className="space-y-2">
                {daySlots.map((slot) => (
                  <div key={slot._index} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Select value={slot.start_time} onValueChange={(v) => updateSlot(slot._index, 'start_time', v)}>
                      <SelectTrigger className="rounded-full h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="font-ui text-xs text-muted-foreground">to</span>
                    <Select value={slot.end_time} onValueChange={(v) => updateSlot(slot._index, 'end_time', v)}>
                      <SelectTrigger className="rounded-full h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={slot.is_active}
                      onCheckedChange={(v) => updateSlot(slot._index, 'is_active', v)}
                      className="ml-auto"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeSlot(slot._index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Button onClick={handleSave} disabled={saving} className="font-ui rounded-full w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Availability
      </Button>
    </div>
  );
};

export default AvailabilityEditor;

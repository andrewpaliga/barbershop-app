import { useParams, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Divider,
  Select,
  FormLayout,
  Checkbox,
  DataTable,
  TextField,
  ButtonGroup,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon } from "@shopify/polaris-icons";
import { useState, useMemo } from "react";
import {
  AutoForm,
  AutoInput,
  AutoSubmit,
  SubmitResultBanner,
  AutoHiddenInput,
} from "@gadgetinc/react/auto/polaris";
import { useAction, useFindMany } from "@gadgetinc/react";
import { api } from "../api";

// Types
interface TimeOption {
  label: string;
  value: string;
}

interface DayOption {
  value: string;
  label: string;
}

interface DayAbbreviations {
  [key: string]: string;
}

interface CalendarViewProps {
  staffId: string;
  weeklyData: any[] | null | undefined;
  dateData: any[] | null | undefined;
  currentWeekStart: Date;
}

interface AvailabilityBlock {
  type: 'weekly' | 'date';
  day: number; // 0-6 for Sunday-Saturday
  startTime: string;
  endTime: string;
  date?: Date;
  location?: string;
  notes?: string;
}

// Generate time options from 6:00 AM to 10:00 PM in 30-minute increments
const generateTimeOptions = (): TimeOption[] => {
  const options: TimeOption[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
      options.push({ label: time12, value: time24 });
    }
  }
  return options;
};

// Combined availability table component
function CombinedAvailabilityTable({ 
  weeklyData, 
  dateData,
  onRefresh 
}: { 
  weeklyData: any[] | null | undefined, 
  dateData: any[] | null | undefined,
  onRefresh: () => void 
}) {
  const [editingRecord, setEditingRecord] = useState<{ type: 'weekly' | 'date', id: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'weekly' | 'date', id: string } | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Action hooks for updating and deleting records
  const [, updateWeeklyAvailability] = useAction(api.staffAvailability.update);
  const [, deleteWeeklyAvailability] = useAction(api.staffAvailability.delete);
  const [, updateDateAvailability] = useAction(api.staffDateAvailability.update);
  const [, deleteDateAvailability] = useAction(api.staffDateAvailability.delete);

  const timeOptions = generateTimeOptions();
  const daysOfWeek: DayOption[] = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  const handleEdit = (record: any, type: 'weekly' | 'date') => {
    setEditingRecord({ type, id: record.id });
    if (type === 'weekly') {
      setEditFormData({
        dayOfWeek: record.dayOfWeek || [],
        startTime: record.startTime || '09:00',
        endTime: record.endTime || '17:00',
        isAvailable: record.isAvailable,
        locationId: record.location?.id || ''
      });
    } else {
      setEditFormData({
        date: record.date ? new Date(record.date).toISOString().split('T')[0] : '',
        startTime: record.startTime || '09:00',
        endTime: record.endTime || '17:00',
        isAvailable: record.isAvailable,
        locationId: record.location?.id || '',
        notes: record.notes || ''
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    try {
      if (editingRecord.type === 'weekly') {
        await updateWeeklyAvailability({
          id: editingRecord.id,
          dayOfWeek: editFormData.dayOfWeek,
          startTime: editFormData.startTime,
          endTime: editFormData.endTime,
          isAvailable: editFormData.isAvailable,
          ...(editFormData.locationId && {
            location: { _link: editFormData.locationId }
          })
        });
      } else {
        await updateDateAvailability({
          id: editingRecord.id,
          date: editFormData.date,
          startTime: editFormData.startTime,
          endTime: editFormData.endTime,
          isAvailable: editFormData.isAvailable,
          notes: editFormData.notes,
          ...(editFormData.locationId && {
            location: { _link: editFormData.locationId }
          })
        });
      }
      
      setEditingRecord(null);
      setEditFormData({});
      onRefresh();
    } catch (error) {
      console.error('Error updating record:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditFormData({});
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      if (deleteConfirm.type === 'weekly') {
        await deleteWeeklyAvailability({ id: deleteConfirm.id });
      } else {
        await deleteDateAvailability({ id: deleteConfirm.id });
      }
      
      setDeleteConfirm(null);
      onRefresh();
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  const combinedRecords = useMemo(() => {
    const records: any[] = [];
    
    // Add weekly availability records
    if (weeklyData && Array.isArray(weeklyData)) {
      weeklyData.forEach(record => {
        if (record) {
          records.push({
            ...record,
            type: 'weekly',
            displayDate: Array.isArray(record.dayOfWeek) 
              ? record.dayOfWeek.map((day: string) => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')
              : record.dayOfWeek || ''
          });
        }
      });
    }
    
    // Add date-specific availability records
    if (dateData && Array.isArray(dateData)) {
      dateData.forEach(record => {
        if (record) {
          records.push({
            ...record,
            type: 'date',
            displayDate: record.date ? new Date(record.date).toLocaleDateString() : ''
          });
        }
      });
    }
    
    return records;
  }, [weeklyData, dateData]);

  if (combinedRecords.length === 0) {
    return (
      <Card background="bg-surface-secondary" padding="400">
        <BlockStack gap="200" align="center">
          <Text as="p" variant="bodyLg" tone="subdued">
            No availability records found
          </Text>
        </BlockStack>
      </Card>
    );
  }

  return (
    <BlockStack gap="300">
      {deleteConfirm && (
        <Banner
          title="Delete availability record?"
          tone="critical"
          action={{
            content: "Delete",
            onAction: handleDelete,
          }}
          secondaryAction={{
            content: "Cancel",
            onAction: () => setDeleteConfirm(null),
          }}
        >
          <Text as="p" variant="bodyMd">
            This action cannot be undone.
          </Text>
        </Banner>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e1e5e9' }}>
          <thead>
            <tr style={{ backgroundColor: '#f6f6f7' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Day/Date</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Start Time</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>End Time</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Available</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Location</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Notes</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #e1e5e9', fontSize: '12px', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {combinedRecords.map((record) => {
              const isEditing = editingRecord?.id === record.id && editingRecord?.type === record.type;
              
              if (isEditing) {
                return (
                  <tr key={`${record.type}-${record.id}`}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9' }} colSpan={8}>
                      <Card>
                        <BlockStack gap="300">
                          <Text as="h4" variant="headingSm">
                            Edit {record.type === 'weekly' ? 'Weekly' : 'Date'} Availability
                          </Text>
                          
                          <FormLayout>
                            {record.type === 'weekly' ? (
                              <div>
                                <Text as="label" variant="bodyMd">Days of Week</Text>
                                <BlockStack gap="200">
                                  {daysOfWeek.map(day => (
                                    <Checkbox
                                      key={day.value}
                                      label={day.label}
                                      checked={(editFormData.dayOfWeek || []).includes(day.value)}
                                      onChange={(checked) => {
                                        const currentDays = editFormData.dayOfWeek || [];
                                        if (checked) {
                                          setEditFormData({
                                            ...editFormData,
                                            dayOfWeek: [...currentDays, day.value]
                                          });
                                        } else {
                                          setEditFormData({
                                            ...editFormData,
                                            dayOfWeek: currentDays.filter((d: string) => d !== day.value)
                                          });
                                        }
                                      }}
                                    />
                                  ))}
                                </BlockStack>
                              </div>
                            ) : (
                              <TextField
                                label="Date"
                                type="date"
                                value={editFormData.date || ''}
                                onChange={(value) => setEditFormData({ ...editFormData, date: value })}
                              />
                            )}
                            
                            <FormLayout.Group>
                              <Select
                                label="Start Time"
                                options={timeOptions}
                                value={editFormData.startTime || '09:00'}
                                onChange={(value) => setEditFormData({ ...editFormData, startTime: value })}
                              />
                              <Select
                                label="End Time"
                                options={timeOptions}
                                value={editFormData.endTime || '17:00'}
                                onChange={(value) => setEditFormData({ ...editFormData, endTime: value })}
                              />
                            </FormLayout.Group>
                            
                            <Checkbox
                              label="Available"
                              checked={editFormData.isAvailable || false}
                              onChange={(checked) => setEditFormData({ ...editFormData, isAvailable: checked })}
                            />
                            
                            {record.type === 'date' && (
                              <TextField
                                label="Notes"
                                value={editFormData.notes || ''}
                                onChange={(value) => setEditFormData({ ...editFormData, notes: value })}
                                multiline={2}
                              />
                            )}
                          </FormLayout>
                          
                          <InlineStack gap="200">
                            <Button variant="primary" onClick={handleSaveEdit}>
                              Save
                            </Button>
                            <Button onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      </Card>
                    </td>
                  </tr>
                );
              }
              
              return (
                <tr key={`${record.type}-${record.id}`}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.type === 'weekly' ? 'Weekly' : 'Date Override'}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.displayDate}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.startTime || ''}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.endTime || ''}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.isAvailable ? 'Yes' : 'No'}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.location?.name || ''}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9', fontSize: '13px' }}>
                    {record.notes || ''}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #e1e5e9' }}>
                    <ButtonGroup>
                      <Button
                        size="micro"
                        icon={EditIcon}
                        onClick={() => handleEdit(record, record.type)}
                        accessibilityLabel="Edit record"
                      />
                      <Button
                        size="micro"
                        icon={DeleteIcon}
                        tone="critical"
                        onClick={() => setDeleteConfirm({ type: record.type, id: record.id })}
                        accessibilityLabel="Delete record"
                      />
                    </ButtonGroup>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlockStack>
  );
}

// Calendar view component
function CalendarView({ staffId, weeklyData, dateData, currentWeekStart }: CalendarViewProps) {
  if (!staffId) {
    return <Text as="p" variant="bodyMd" tone="critical">Error: Staff ID is required</Text>;
  }

  // Generate time slots from 8 AM to 6 PM in 30-minute increments
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 18 && minute > 0) break; // Stop at 6:00 PM
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
        slots.push({ time24, time12 });
      }
    }
    return slots;
  }, []);

  // Get days of the week for the current week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        dayOfWeek: i
      });
    }
    return days;
  }, [currentWeekStart]);

  // Convert day name to number (0 = Sunday)
  const dayNameToNumber = (dayName: string): number => {
    const mapping: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    return mapping[dayName.toLowerCase()] ?? -1;
  };

  // Process availability data into blocks
  const availabilityBlocks = useMemo(() => {
    const blocks: AvailabilityBlock[] = [];

    // Process weekly data
    if (weeklyData && Array.isArray(weeklyData)) {
      weeklyData.forEach(record => {
        if (record && record.isAvailable) {
          const days = Array.isArray(record.dayOfWeek) ? record.dayOfWeek : [record.dayOfWeek];
          days.forEach((day: string) => {
            const dayNumber = dayNameToNumber(day);
            if (dayNumber >= 0) {
              blocks.push({
                type: 'weekly',
                day: dayNumber,
                startTime: record.startTime || '',
                endTime: record.endTime || '',
                location: record.location?.name
              });
            }
          });
        }
      });
    }

    // Process date-specific data for the current week
    if (dateData && Array.isArray(dateData)) {
      dateData.forEach(record => {
        if (record && record.isAvailable) {
          const recordDate = new Date(record.date);
          const weekStart = new Date(currentWeekStart);
          const weekEnd = new Date(currentWeekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          if (recordDate >= weekStart && recordDate <= weekEnd) {
            blocks.push({
              type: 'date',
              day: recordDate.getDay(),
              startTime: record.startTime || '',
              endTime: record.endTime || '',
              date: recordDate,
              location: record.location?.name,
              notes: record.notes
            });
          }
        }
      });
    }

    return blocks;
  }, [weeklyData, dateData, currentWeekStart]);

  // Calculate block positions
  const getBlockPosition = (startTime: string, endTime: string) => {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    const dayStartMinutes = 8 * 60; // 8 AM
    const slotDurationMinutes = 30;
    
    const startSlot = Math.floor((startMinutes - dayStartMinutes) / slotDurationMinutes);
    const duration = Math.ceil((endMinutes - startMinutes) / slotDurationMinutes);
    
    return { startSlot, duration };
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '80px repeat(7, 1fr)',
      gap: '1px',
      backgroundColor: '#e1e5e9',
      border: '1px solid #e1e5e9',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Header row */}
      <div style={{ 
        backgroundColor: '#f6f6f7', 
        padding: '12px 8px', 
        borderBottom: '2px solid #e1e5e9',
        fontSize: '12px',
        fontWeight: 600
      }}>
        Time
      </div>
      
      {weekDays.map(day => (
        <div key={day.dayOfWeek} style={{ 
          backgroundColor: '#f6f6f7', 
          padding: '12px 8px', 
          textAlign: 'center',
          borderBottom: '2px solid #e1e5e9',
          fontSize: '12px',
          fontWeight: 600
        }}>
          <div>{day.dayName}</div>
          <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '2px' }}>
            {day.dayNumber}
          </div>
        </div>
      ))}

      {/* Time slots and calendar grid */}
      {timeSlots.map((slot, slotIndex) => (
        <div key={`row-${slotIndex}`} style={{ display: 'contents' }}>
          {/* Time label */}
          <div style={{ 
            backgroundColor: '#f6f6f7', 
            padding: '8px 6px', 
            fontSize: '11px',
            color: '#6d7175',
            textAlign: 'center',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {slot.time12}
          </div>
          
          {/* Day columns */}
          {weekDays.map(day => {
            const dayBlocks = availabilityBlocks.filter(block => 
              block.day === day.dayOfWeek &&
              getBlockPosition(block.startTime, block.endTime).startSlot <= slotIndex &&
              getBlockPosition(block.startTime, block.endTime).startSlot + getBlockPosition(block.startTime, block.endTime).duration > slotIndex
            );
            
            return (
              <div key={`${day.dayOfWeek}-${slotIndex}`} style={{ 
                backgroundColor: 'white',
                minHeight: '40px',
                position: 'relative',
                borderRight: '1px solid #e1e5e9'
              }}>
                {dayBlocks.map((block, blockIndex) => {
                  const { startSlot, duration } = getBlockPosition(block.startTime, block.endTime);
                  const isFirstSlot = slotIndex === startSlot;
                  
                  if (!isFirstSlot) return null;
                  
                  return (
                    <div
                      key={blockIndex}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '2px',
                        right: '2px',
                        height: `${duration * 40 - 2}px`,
                        backgroundColor: block.type === 'weekly' ? '#e3f2fd' : '#e8f5e8',
                        border: `1px solid ${block.type === 'weekly' ? '#2196f3' : '#4caf50'}`,
                        borderRadius: '4px',
                        padding: '4px',
                        fontSize: '10px',
                        color: block.type === 'weekly' ? '#1976d2' : '#2e7d32',
                        overflow: 'hidden',
                        zIndex: 1
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {block.startTime} - {block.endTime}
                      </div>
                      {block.location && (
                        <div style={{ fontSize: '9px', opacity: 0.8 }}>
                          {block.location}
                        </div>
                      )}
                      {block.type === 'date' && block.notes && (
                        <div style={{ fontSize: '9px', opacity: 0.8 }}>
                          {block.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function StaffEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showAddAvailability, setShowAddAvailability] = useState<boolean>(false);
  const [showAddDateAvailability, setShowAddDateAvailability] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [dateStartTime, setDateStartTime] = useState<string>('09:00');
  const [dateEndTime, setDateEndTime] = useState<string>('17:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [{ data: deleteData, fetching: deleting, error: deleteError }, deleteStaff] = useAction(api.staff.delete);

  // Fetch availability data for the calendar
  const [{ data: weeklyData }] = useFindMany(api.staffAvailability, {
    filter: { staffId: { equals: id } },
    sort: [{ dayOfWeek: "Ascending" }, { startTime: "Ascending" }],
    select: {
      id: true,
      staffId: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      isAvailable: true,
      location: {
        id: true,
        name: true
      }
    }
  }, [refreshTrigger]);

  const [{ data: dateData }] = useFindMany(api.staffDateAvailability, {
    filter: { staffId: { equals: id } },
    sort: [{ date: "Descending" }],
    select: {
      id: true,
      staffId: true,
      date: true,
      startTime: true,
      endTime: true,
      isAvailable: true,
      notes: true,
      location: {
        id: true,
        name: true
      }
    }
  }, [refreshTrigger]);

  const handleRefreshAvailability = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const timeOptions = generateTimeOptions();
  
  const daysOfWeek: DayOption[] = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  const handleDayChange = (day: string, checked: boolean) => {
    if (checked) {
      setSelectedDays([...selectedDays, day]);
    } else {
      setSelectedDays(selectedDays.filter(d => d !== day));
    }
  };

  const handleDelete = async () => {
    if (id) {
      await deleteStaff({ id });
      if (!deleteError) {
        navigate("/staff");
      }
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newWeekStart);
  };

  const formatWeekRange = (weekStart: Date): string => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const startDay = weekStart.getDate();
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const endDay = weekEnd.getDate();
    const year = weekStart.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  };

  return (
    <Page
      backAction={{
        content: "Staff",
        onAction: () => navigate("/staff"),
      }}
      title="Edit Staff Member"
      primaryAction={
        <Button
          variant="primary"
          form="staff-edit-form"
          submit
          loading={false}
        >
          Save
        </Button>
      }
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          icon: DeleteIcon,
          onAction: () => setShowDeleteConfirm(true),
        },
      ]}
    >
      <BlockStack gap="500">
        {showDeleteConfirm && (
          <Banner
            title="Delete staff member?"
            tone="critical"
            action={{
              content: "Delete",
              onAction: handleDelete,
              loading: deleting,
            }}
            secondaryAction={{
              content: "Cancel",
              onAction: () => setShowDeleteConfirm(false),
            }}
          >
            <Text as="p" variant="bodyMd">
              This action cannot be undone. This will permanently delete the staff member.
            </Text>
          </Banner>
        )}

        {deleteError && (
          <Banner title="Error deleting staff member" tone="critical">
            <Text as="p" variant="bodyMd">
              {deleteError.toString()}
            </Text>
          </Banner>
        )}

        <Card>
          <AutoForm action={api.staff.update} findBy={id} id="staff-edit-form">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Staff Information
              </Text>
              
              <BlockStack gap="300">
                <AutoInput field="name" />
                <AutoInput field="email" />
                <AutoInput field="phone" />
                <AutoInput field="bio" />
                <AutoInput field="isActive" />
              </BlockStack>

              <SubmitResultBanner />
            </BlockStack>
          </AutoForm>
        </Card>



        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">
                Availability Management
              </Text>
              <InlineStack gap="200">
                <Button
                  variant={showAddAvailability ? "secondary" : "primary"}
                  icon={showAddAvailability ? XIcon : PlusIcon}
                  disabled={showAddDateAvailability}
                  onClick={() => setShowAddAvailability(!showAddAvailability)}
                >
                  {showAddAvailability ? "Cancel Weekly" : "Add Weekly"}
                </Button>
                <Button
                  variant={showAddDateAvailability ? "secondary" : "primary"}
                  icon={showAddDateAvailability ? XIcon : PlusIcon}
                  disabled={showAddAvailability}
                  onClick={() => setShowAddDateAvailability(!showAddDateAvailability)}
                >
                  {showAddDateAvailability ? "Cancel Override" : "Add Date Override"}
                </Button>
              </InlineStack>
            </InlineStack>

            {showAddAvailability && (
              <>
                <Divider />
                <Card background="bg-surface-secondary">
                  <AutoForm 
                    action={api.staffAvailability.create}
                    defaultValues={{
                      staffAvailability: {
                        staff: { _link: id }
                      }
                    }}
                    onSuccess={() => {
                      setShowAddAvailability(false);
                      setStartTime('09:00');
                      setEndTime('17:00');
                      setSelectedDays([]);
                      handleRefreshAvailability();
                    }}
                  >
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingSm">
                        Add Weekly Schedule
                      </Text>
                      
                      <BlockStack gap="300">
                        <div>
                          <Text as="p" variant="bodyMd">Days of Week *</Text>
                          <BlockStack gap="200">
                            {daysOfWeek.map(day => (
                              <Checkbox
                                key={day.value}
                                label={day.label}
                                checked={selectedDays.includes(day.value)}
                                onChange={(checked) => handleDayChange(day.value, checked)}
                              />
                            ))}
                          </BlockStack>
                        </div>
                        
                        <FormLayout.Group>
                          <div>
                            <Text as="label" variant="bodyMd">Start time *</Text>
                            <Select
                              options={timeOptions}
                              value={startTime}
                              onChange={(value) => setStartTime(value)}
                            />
                          </div>
                          <div>
                            <Text as="label" variant="bodyMd">End time *</Text>
                            <Select
                              options={timeOptions}
                              value={endTime}
                              onChange={(value) => setEndTime(value)}
                            />
                          </div>
                        </FormLayout.Group>
                        
                        <AutoHiddenInput field="dayOfWeek" value={selectedDays} />
                        <AutoHiddenInput field="startTime" value={startTime} />
                        <AutoHiddenInput field="endTime" value={endTime} />
                        <AutoHiddenInput field="isAvailable" value={true} />
                        
                        <AutoInput field="location" />
                      </BlockStack>

                      <SubmitResultBanner />
                      
                      <InlineStack gap="200">
                        <AutoSubmit variant="primary">Create Weekly Schedule</AutoSubmit>
                        <Button onClick={() => {
                          setShowAddAvailability(false);
                          setSelectedDays([]);
                        }}>
                          Cancel
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </AutoForm>
                </Card>
                <Divider />
              </>
            )}

            {showAddDateAvailability && (
              <>
                <Divider />
                <Card background="bg-surface-secondary">
                  <AutoForm 
                    action={api.staffDateAvailability.create}
                    defaultValues={{
                      staffDateAvailability: {
                        staff: { _link: id }
                      }
                    }}
                    onSuccess={() => {
                      setShowAddDateAvailability(false);
                      setDateStartTime('09:00');
                      setDateEndTime('17:00');
                      handleRefreshAvailability();
                    }}
                  >
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingSm">
                        Add Date Override
                      </Text>
                      
                      <BlockStack gap="300">
                        <AutoInput field="date" />
                        
                        <FormLayout.Group>
                          <div>
                            <Text as="label" variant="bodyMd">Start time *</Text>
                            <Select
                              options={timeOptions}
                              value={dateStartTime}
                              onChange={(value) => setDateStartTime(value)}
                            />
                          </div>
                          <div>
                            <Text as="label" variant="bodyMd">End time *</Text>
                            <Select
                              options={timeOptions}
                              value={dateEndTime}
                              onChange={(value) => setDateEndTime(value)}
                            />
                          </div>
                        </FormLayout.Group>
                        
                        <AutoHiddenInput field="startTime" value={dateStartTime} />
                        <AutoHiddenInput field="endTime" value={dateEndTime} />
                        <AutoHiddenInput field="isAvailable" value={true} />
                        
                        <AutoInput field="location" />
                        <AutoInput field="notes" />
                      </BlockStack>

                      <SubmitResultBanner />
                      
                      <InlineStack gap="200">
                        <AutoSubmit variant="primary">Create Date Override</AutoSubmit>
                        <Button onClick={() => setShowAddDateAvailability(false)}>
                          Cancel
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </AutoForm>
                </Card>
                <Divider />
              </>
            )}

            {/* Availability Details */}
            {(!weeklyData || weeklyData.length === 0) && (!dateData || dateData.length === 0) ? (
              <Card background="bg-surface-secondary" padding="400">
                <BlockStack gap="200" align="center">
                  <Text as="p" variant="bodyLg" tone="subdued">
                    No availability schedules found
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Use the management section above to add weekly schedules or date-specific overrides.
                  </Text>
                </BlockStack>
              </Card>
            ) : (
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Availability Details
                </Text>
                <CombinedAvailabilityTable 
                  weeklyData={weeklyData} 
                  dateData={dateData}
                  onRefresh={handleRefreshAvailability}
                />
              </BlockStack>
            )}

          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="500">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">
                Availability Calendar
              </Text>
              
              {/* Week Navigation */}
              <InlineStack gap="200" blockAlign="center">
                <Button
                  icon={ChevronLeftIcon}
                  variant="tertiary"
                  onClick={() => navigateWeek('prev')}
                  accessibilityLabel="Previous week"
                />
                <Text as="p" variant="bodyMd">
                  {formatWeekRange(currentWeekStart)}
                </Text>
                <Button
                  icon={ChevronRightIcon}
                  variant="tertiary"
                  onClick={() => navigateWeek('next')}
                  accessibilityLabel="Next week"
                />
              </InlineStack>
            </InlineStack>
            
            {/* Legend */}
            <InlineStack gap="300" blockAlign="center">
              <InlineStack gap="100" blockAlign="center">
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: '#e3f2fd', 
                  border: '1px solid #2196f3', 
                  borderRadius: '3px' 
                }} />
                <Text as="span" variant="bodyMd" tone="subdued">Weekly Schedule</Text>
              </InlineStack>
              <InlineStack gap="100" blockAlign="center">
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: '#e8f5e8', 
                  border: '1px solid #4caf50', 
                  borderRadius: '3px' 
                }} />
                <Text as="span" variant="bodyMd" tone="subdued">Date Override</Text>
              </InlineStack>
            </InlineStack>

            {/* Calendar View */}
            {(weeklyData && weeklyData.length > 0) || (dateData && dateData.length > 0) ? (
              <CalendarView 
                staffId={id || ''} 
                weeklyData={weeklyData || []} 
                dateData={dateData || []}
                currentWeekStart={currentWeekStart}
              />
            ) : (
              <Card background="bg-surface-secondary" padding="400">
                <BlockStack gap="200" align="center">
                  <Text as="p" variant="bodyLg" tone="subdued">
                    No availability schedules found
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Add weekly schedules or date-specific overrides in the management section above to see the calendar view.
                  </Text>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

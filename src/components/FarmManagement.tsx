import React, { useMemo, useState } from 'react';
import {
  Check,
  Droplets,
  Edit3,
  Layers,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AuthUser,
  FarmItem,
  FieldItem,
  GeoJsonPolygon,
  LanguageCode,
  ProvinceInfo,
} from '../types';
import { VoiceInputButton } from './AccessibilityControls';
import { FarmerAccessControlPanel } from './FarmerAccessControlPanel';
import { InteractiveFarmMap, SpatialUpdatePayload } from './InteractiveFarmMap';

interface FarmManagementProps {
  user: AuthUser;
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string) => void;
  onRefreshFarms: () => Promise<void>;
  provinces: ProvinceInfo[];
  languageCode: LanguageCode;
  isListening: boolean;
  recognitionSupported: boolean;
  onStartVoiceInput: (cb: (txt: string) => void) => void;
}

export const FarmManagement: React.FC<FarmManagementProps> = ({
  user,
  farms,
  selectedFarmId,
  onSelectFarm,
  onRefreshFarms,
  provinces,
  languageCode,
  isListening,
  recognitionSupported,
  onStartVoiceInput,
}) => {
  const canCreateFarm =
    user.roleCode === 'existing_farmer' || user.roleCode === 'system_administrator';

  const activeFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) || farms[0] || null,
    [farms, selectedFarmId]
  );

  // Inline Map Editing State for Active Farm
  const [editingMapInline, setEditingMapInline] = useState(false);
  const [inlineSpatialDraft, setInlineSpatialDraft] = useState<SpatialUpdatePayload | null>(null);
  const [savingInlineMap, setSavingInlineMap] = useState(false);

  // Farm Form Modal (Create or Edit)
  const [farmModalMode, setFarmModalMode] = useState<'create' | 'edit' | null>(null);
  const [formName, setFormName] = useState('');
  const [formProvince, setFormProvince] = useState(provinces[0]?.name || 'KwaZulu-Natal');
  const [formDistrict, setFormDistrict] = useState('');
  const [formLocalMuni, setFormLocalMuni] = useState('');
  const [formTown, setFormTown] = useState('');
  const [formSizeHa, setFormSizeHa] = useState(10);
  const [formExpYears, setFormExpYears] = useState(5);
  const [formWater, setFormWater] = useState('Borehole & Storage Tank');
  const [formActivities, setFormActivities] = useState<string[]>([]);
  const [formCropsText, setFormCropsText] = useState('');
  const [formLivestockText, setFormLivestockText] = useState('');
  const [modalSpatial, setModalSpatial] = useState<SpatialUpdatePayload | null>(null);
  const [savingFarm, setSavingFarm] = useState(false);
  const [farmError, setFarmError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteTargetFarm, setDeleteTargetFarm] = useState<FarmItem | null>(null);
  const [deletingFarm, setDeletingFarm] = useState(false);

  // Field Form Modal (Create or Edit + Field Boundary Map)
  const [fieldModalMode, setFieldModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldCrop, setFieldCrop] = useState('');
  const [fieldArea, setFieldArea] = useState(2.5);
  const [fieldSoil, setFieldSoil] = useState('Red Sandy Loam');
  const [fieldIrrigation, setFieldIrrigation] = useState('Drip Irrigation');
  const [fieldStatus, setFieldStatus] = useState<'active' | 'fallow' | 'preparing'>('active');
  const [fieldNotes, setFieldNotes] = useState('');
  const [fieldBoundary, setFieldBoundary] = useState<GeoJsonPolygon | null>(null);
  const [savingField, setSavingField] = useState(false);

  const selectedProvinceObj = useMemo(
    () => provinces.find((p) => p.name === formProvince) || provinces[0],
    [provinces, formProvince]
  );
  const selectedDistrictObj = useMemo(
    () =>
      selectedProvinceObj?.districts.find((d) => d.name === formDistrict) ||
      selectedProvinceObj?.districts[0],
    [selectedProvinceObj, formDistrict]
  );

  const openCreateFarm = () => {
    const p = provinces[0];
    const d = p?.districts[0];
    setFarmModalMode('create');
    setFormName('');
    setFormProvince(p?.name || 'KwaZulu-Natal');
    setFormDistrict(d?.name || '');
    setFormLocalMuni(d?.localMunicipalities[0] || '');
    setFormTown('');
    setFormSizeHa(10);
    setFormExpYears(user.profile?.farmerExperienceYears || 3);
    setFormWater('Borehole & Storage Tank');
    setFormActivities(['Vegetables & Horticulture']);
    setFormCropsText('Yellow Maize, Cabbage');
    setFormLivestockText('');
    setModalSpatial({
      latitude: d?.center.lat || -29.6006,
      longitude: d?.center.lng || 30.3794,
      locationSource: 'municipal_center',
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAccuracyMeters: null,
      gpsCapturedAt: null,
      boundaryGeojson: null,
    });
    setFarmError(null);
  };

  const openEditFarm = (farm: FarmItem) => {
    setFarmModalMode('edit');
    setFormName(farm.name);
    setFormProvince(farm.location?.province || provinces[0]?.name || 'KwaZulu-Natal');
    setFormDistrict(farm.location?.districtMunicipality || '');
    setFormLocalMuni(farm.location?.localMunicipality || '');
    setFormTown(farm.location?.townOrVillage || '');
    setFormSizeHa(farm.farmSizeHectares);
    setFormExpYears(farm.yearsOfExperience);
    setFormWater(farm.waterAvailability);
    setFormActivities(farm.farmingActivities);
    setFormCropsText(farm.existingCrops.join(', '));
    setFormLivestockText(farm.existingLivestock.join(', '));
    setModalSpatial({
      latitude: farm.location?.latitude ?? -28.4793,
      longitude: farm.location?.longitude ?? 24.6727,
      locationSource: farm.location?.locationSource || 'municipal_center',
      gpsLatitude: farm.location?.gpsLatitude ?? null,
      gpsLongitude: farm.location?.gpsLongitude ?? null,
      gpsAccuracyMeters: farm.location?.gpsAccuracyMeters ?? null,
      gpsCapturedAt: farm.location?.gpsCapturedAt ?? null,
      boundaryGeojson: farm.boundary?.geojson || null,
    });
    setFarmError(null);
  };

  const handleSaveFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFarmError(null);
    setSavingFarm(true);
    const payload = {
      name: formName,
      province: formProvince,
      districtMunicipality: formDistrict || selectedDistrictObj?.name || '',
      localMunicipality: formLocalMuni || selectedDistrictObj?.localMunicipalities[0] || '',
      townOrVillage: formTown,
      latitude: modalSpatial?.latitude ?? selectedDistrictObj?.center.lat ?? -28.4793,
      longitude: modalSpatial?.longitude ?? selectedDistrictObj?.center.lng ?? 24.6727,
      locationSource: modalSpatial?.locationSource || 'municipal_center',
      gpsLatitude: modalSpatial?.gpsLatitude ?? null,
      gpsLongitude: modalSpatial?.gpsLongitude ?? null,
      gpsAccuracyMeters: modalSpatial?.gpsAccuracyMeters ?? null,
      gpsCapturedAt: modalSpatial?.gpsCapturedAt ?? null,
      farmSizeHectares: formSizeHa,
      yearsOfExperience: formExpYears,
      waterAvailability: formWater,
      farmingActivities: formActivities,
      existingCrops: formCropsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      existingLivestock: formLivestockText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      boundaryGeojson: modalSpatial?.boundaryGeojson || null,
    };

    try {
      if (farmModalMode === 'create') {
        const created = await apiRequest<FarmItem>('/api/farms', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await onRefreshFarms();
        onSelectFarm(created.id);
      } else if (farmModalMode === 'edit' && activeFarm) {
        await apiRequest<FarmItem>(`/api/farms/${activeFarm.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await onRefreshFarms();
      }
      setFarmModalMode(null);
    } catch (err: unknown) {
      setFarmError(err instanceof Error ? err.message : 'Unable to save farm.');
    } finally {
      setSavingFarm(false);
    }
  };

  const handleSaveInlineSpatial = async () => {
    if (!activeFarm || !inlineSpatialDraft) return;
    setSavingInlineMap(true);
    try {
      await apiRequest(`/api/farms/${activeFarm.id}/spatial`, {
        method: 'PUT',
        body: JSON.stringify({
          ...inlineSpatialDraft,
          clearBoundary: inlineSpatialDraft.boundaryGeojson === null,
        }),
      });
      await onRefreshFarms();
      setEditingMapInline(false);
      setInlineSpatialDraft(null);
    } finally {
      setSavingInlineMap(false);
    }
  };

  const confirmDeleteFarm = async () => {
    if (!deleteTargetFarm) return;
    setDeletingFarm(true);
    try {
      await apiRequest(`/api/farms/${deleteTargetFarm.id}`, { method: 'DELETE' });
      setDeleteTargetFarm(null);
      await onRefreshFarms();
    } finally {
      setDeletingFarm(false);
    }
  };

  const openCreateField = () => {
    setFieldModalMode('create');
    setEditingFieldId(null);
    setFieldName('');
    setFieldCrop('');
    setFieldArea(2);
    setFieldSoil('Red Loam');
    setFieldIrrigation('Drip Irrigation');
    setFieldStatus('active');
    setFieldNotes('');
    setFieldBoundary(null);
  };

  const openEditField = (field: FieldItem) => {
    setFieldModalMode('edit');
    setEditingFieldId(field.id);
    setFieldName(field.name);
    setFieldCrop(field.cropOrLivestock);
    setFieldArea(field.areaHectares);
    setFieldSoil(field.soilType);
    setFieldIrrigation(field.irrigationType);
    setFieldStatus(field.status);
    setFieldNotes(field.notes);
    setFieldBoundary(field.geojson || null);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm) return;
    setSavingField(true);
    try {
      if (fieldModalMode === 'create') {
        await apiRequest(`/api/farms/${activeFarm.id}/fields`, {
          method: 'POST',
          body: JSON.stringify({
            name: fieldName,
            cropOrLivestock: fieldCrop,
            areaHectares: fieldArea,
            soilType: fieldSoil,
            irrigationType: fieldIrrigation,
            status: fieldStatus,
            notes: fieldNotes,
            geojson: fieldBoundary,
          }),
        });
      } else if (fieldModalMode === 'edit' && editingFieldId) {
        await apiRequest(`/api/fields/${editingFieldId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: fieldName,
            cropOrLivestock: fieldCrop,
            areaHectares: fieldArea,
            soilType: fieldSoil,
            irrigationType: fieldIrrigation,
            status: fieldStatus,
            notes: fieldNotes,
            geojson: fieldBoundary,
          }),
        });
      }
      setFieldModalMode(null);
      await onRefreshFarms();
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    await apiRequest(`/api/fields/${fieldId}`, { method: 'DELETE' });
    await onRefreshFarms();
  };

  const canModifyActiveFarm =
    activeFarm &&
    (activeFarm.ownerId === user.id || user.roleCode === 'system_administrator');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Farms, GPS & Field Mapping
          </h1>
          <p className="text-sm text-[#4A5A50] mt-0.5">
            Capture GPS coordinates, adjust OpenStreetMap markers, draw farm and field boundaries, and verify hectare areas.
          </p>
        </div>

        {canCreateFarm && (
          <button
            type="button"
            onClick={openCreateFarm}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Farm</span>
          </button>
        )}
      </div>

      {farms.length === 0 ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-10 text-center space-y-4">
          <p className="font-display text-lg font-semibold text-[#143326]">
            No farms registered yet
          </p>
          <p className="text-sm text-[#4A5A50] max-w-md mx-auto">
            Add your first South African farm to capture GPS location, draw spatial boundaries, and manage fields.
          </p>
          {canCreateFarm && (
            <button
              type="button"
              onClick={openCreateFarm}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1B4332] text-white font-semibold text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register First Farm</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Farm Listing & Selector */}
          <div className="lg:col-span-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
              Registered Farms ({farms.length})
            </p>
            <div className="space-y-2.5">
              {farms.map((farm) => {
                const selected = activeFarm?.id === farm.id;
                return (
                  <button
                    key={farm.id}
                    type="button"
                    onClick={() => {
                      onSelectFarm(farm.id);
                      setEditingMapInline(false);
                      setInlineSpatialDraft(null);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-white text-[#17201B] border-[#E2E6DF] hover:border-[#2D6A4F]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display font-bold text-base">{farm.name}</p>
                      <span
                        className={`font-mono text-xs tabular-nums shrink-0 ${
                          selected ? 'text-[#D8E9DC]' : 'text-[#2D6A4F]'
                        }`}
                      >
                        {farm.farmSizeHectares} ha
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-1 ${
                        selected ? 'text-[#DCE8DF]' : 'text-[#4A5A50]'
                      }`}
                    >
                      {farm.location?.townOrVillage} · {farm.location?.province}
                    </p>
                    <p
                      className={`text-xs mt-2 ${
                        selected ? 'text-[#B7DEC4]' : 'text-[#4A5A50]'
                      }`}
                    >
                      {farm.fields.length} field{farm.fields.length === 1 ? '' : 's'} ·{' '}
                      {farm.boundary
                        ? `Boundary ${farm.boundary.calculatedAreaHectares} ha`
                        : 'Boundary not drawn'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Farm Profile, Interactive Map & Fields */}
          {activeFarm && (
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#2D6A4F] font-medium">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>
                        {activeFarm.location?.townOrVillage} · {activeFarm.location?.localMunicipality} ·{' '}
                        {activeFarm.location?.districtMunicipality} · {activeFarm.location?.province}
                      </span>
                    </div>
                    <h2 className="font-display text-2xl font-bold text-[#143326] mt-1">
                      {activeFarm.name}
                    </h2>
                  </div>

                  {canModifyActiveFarm && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditFarm(activeFarm)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-sm font-semibold text-[#143326] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit Farm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetFarm(activeFarm)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8B4B4] bg-[#FDF2F2] hover:bg-[#FADEDE] text-sm font-semibold text-[#8E2424] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Structured Farm Profile Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-[#E2E6DF]">
                  <div>
                    <p className="text-xs text-[#4A5A50]">Declared Farm Size</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#143326]">
                      {activeFarm.farmSizeHectares} ha
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4A5A50]">Drawn Boundary Area</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#1B4332]">
                      {activeFarm.boundary
                        ? `${activeFarm.boundary.calculatedAreaHectares} ha`
                        : 'Not drawn'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4A5A50]">Water Supply</p>
                    <p className="text-sm font-semibold text-[#143326] mt-0.5 flex items-center gap-1">
                      <Droplets className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                      <span>{activeFarm.waterAvailability}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4A5A50]">Mapped Fields</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#143326]">
                      {activeFarm.fields.length}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
                      Existing Crops
                    </p>
                    <p className="text-[#17201B] mt-1">
                      {activeFarm.existingCrops.length > 0
                        ? activeFarm.existingCrops.join(' · ')
                        : 'No crops recorded'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
                      Existing Livestock
                    </p>
                    <p className="text-[#17201B] mt-1">
                      {activeFarm.existingLivestock.length > 0
                        ? activeFarm.existingLivestock.join(' · ')
                        : 'No livestock recorded'}
                    </p>
                  </div>
                </div>

                {/* Interactive Map & Inline Boundary Editor */}
                {activeFarm.location && (
                  <div className="space-y-3">
                    {canModifyActiveFarm && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#4A5A50]">
                          {editingMapInline
                            ? 'Editing farm GPS pin and boundary vertices directly on OpenStreetMap'
                            : 'View farm location, GPS coordinates, and saved boundary'}
                        </p>
                        {!editingMapInline ? (
                          <button
                            type="button"
                            onClick={() => setEditingMapInline(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-[#143326] text-xs font-semibold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit GPS / Draw Boundary on Map</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMapInline(false);
                                setInlineSpatialDraft(null);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingInlineMap || !inlineSpatialDraft}
                              onClick={handleSaveInlineSpatial}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{savingInlineMap ? 'Saving...' : 'Save Spatial Map'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <InteractiveFarmMap
                      latitude={activeFarm.location.latitude}
                      longitude={activeFarm.location.longitude}
                      locationSource={activeFarm.location.locationSource}
                      gpsLatitude={activeFarm.location.gpsLatitude}
                      gpsLongitude={activeFarm.location.gpsLongitude}
                      gpsAccuracyMeters={activeFarm.location.gpsAccuracyMeters}
                      gpsCapturedAt={activeFarm.location.gpsCapturedAt}
                      boundary={activeFarm.boundary?.geojson || null}
                      fields={activeFarm.fields}
                      onSpatialChange={setInlineSpatialDraft}
                      readOnly={!editingMapInline}
                    />
                  </div>
                )}
              </div>

              {/* Field Management Section */}
              <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#1B4332]" />
                    <h3 className="font-display text-lg font-bold text-[#143326]">
                      Fields & Grazing Camps ({activeFarm.fields.length})
                    </h3>
                  </div>
                  {canModifyActiveFarm && (
                    <button
                      type="button"
                      onClick={openCreateField}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Field</span>
                    </button>
                  )}
                </div>

                {activeFarm.fields.length === 0 ? (
                  <p className="text-sm text-[#4A5A50] py-4">
                    No fields added to this farm yet. Add individual crop blocks or grazing camps and map their boundaries.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E2E6DF]">
                    {activeFarm.fields.map((fld) => (
                      <div
                        key={fld.id}
                        className="py-4 flex flex-wrap items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#143326]">{fld.name}</p>
                            <span className="text-xs text-[#2D6A4F] font-medium capitalize">
                              · {fld.status}
                            </span>
                          </div>
                          <p className="text-sm text-[#35443B]">{fld.cropOrLivestock}</p>
                          <p className="text-xs text-[#4A5A50]">
                            <span className="font-mono tabular-nums">{fld.areaHectares} ha</span> ·{' '}
                            {fld.soilType} · {fld.irrigationType} ·{' '}
                            {fld.geojson ? 'Spatial boundary saved' : 'No field polygon yet'}
                          </p>
                          {fld.notes && <p className="text-xs text-[#4A5A50] pt-1">{fld.notes}</p>}
                        </div>

                        {canModifyActiveFarm && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditField(fld)}
                              className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] text-xs font-semibold hover:bg-[#EDF2EC] cursor-pointer"
                            >
                              Edit & Map
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteField(fld.id)}
                              className="px-3 py-1.5 rounded-lg border border-[#E8B4B4] text-xs font-semibold text-[#8E2424] hover:bg-[#FDF2F2] cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(user.roleCode === 'existing_farmer' || user.roleCode === 'system_administrator') &&
                canModifyActiveFarm && (
                  <FarmerAccessControlPanel farms={farms} selectedFarmId={activeFarm.id} />
                )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Farm Modal */}
      {farmModalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-3xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#143326]">
                {farmModalMode === 'create' ? 'Register New Farm' : 'Edit Farm Details'}
              </h3>
              <button
                type="button"
                onClick={() => setFarmModalMode(null)}
                className="p-2 rounded-lg hover:bg-[#F1F3EF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {farmError && (
              <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
                {farmError}
              </div>
            )}

            <form onSubmit={handleSaveFarm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold">Farm Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Mooi River Dairy & Maize Plot"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                  <VoiceInputButton
                    languageCode={languageCode}
                    isListening={isListening}
                    supported={recognitionSupported}
                    onStart={() => onStartVoiceInput((txt) => setFormName(txt))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Province</label>
                  <select
                    value={formProvince}
                    onChange={(e) => {
                      const p = provinces.find((item) => item.name === e.target.value);
                      const d = p?.districts[0];
                      setFormProvince(e.target.value);
                      setFormDistrict(d?.name || '');
                      setFormLocalMuni(d?.localMunicipalities[0] || '');
                      if (d) {
                        setModalSpatial((prev) => ({
                          latitude: d.center.lat,
                          longitude: d.center.lng,
                          locationSource: 'municipal_center',
                          gpsLatitude: prev?.gpsLatitude ?? null,
                          gpsLongitude: prev?.gpsLongitude ?? null,
                          gpsAccuracyMeters: prev?.gpsAccuracyMeters ?? null,
                          gpsCapturedAt: prev?.gpsCapturedAt ?? null,
                          boundaryGeojson: prev?.boundaryGeojson ?? null,
                        }));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white"
                  >
                    {provinces.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">District Municipality</label>
                  <select
                    value={formDistrict || selectedDistrictObj?.name || ''}
                    onChange={(e) => {
                      const d = selectedProvinceObj?.districts.find((x) => x.name === e.target.value);
                      setFormDistrict(e.target.value);
                      setFormLocalMuni(d?.localMunicipalities[0] || '');
                      if (d) {
                        setModalSpatial((prev) => ({
                          latitude: d.center.lat,
                          longitude: d.center.lng,
                          locationSource: 'municipal_center',
                          gpsLatitude: prev?.gpsLatitude ?? null,
                          gpsLongitude: prev?.gpsLongitude ?? null,
                          gpsAccuracyMeters: prev?.gpsAccuracyMeters ?? null,
                          gpsCapturedAt: prev?.gpsCapturedAt ?? null,
                          boundaryGeojson: prev?.boundaryGeojson ?? null,
                        }));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white"
                  >
                    {(selectedProvinceObj?.districts || []).map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Local Municipality</label>
                  <select
                    value={formLocalMuni || selectedDistrictObj?.localMunicipalities[0] || ''}
                    onChange={(e) => setFormLocalMuni(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white"
                  >
                    {(selectedDistrictObj?.localMunicipalities || []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Town or Village</label>
                  <input
                    type="text"
                    required
                    value={formTown}
                    onChange={(e) => setFormTown(e.target.value)}
                    placeholder="e.g. Underberg"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Declared Size (ha)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={formSizeHa}
                    onChange={(e) => setFormSizeHa(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Experience (yrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={formExpYears}
                    onChange={(e) => setFormExpYears(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Water Source</label>
                  <input
                    type="text"
                    required
                    value={formWater}
                    onChange={(e) => setFormWater(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Existing Crops (comma separated)</label>
                  <input
                    type="text"
                    value={formCropsText}
                    onChange={(e) => setFormCropsText(e.target.value)}
                    placeholder="Maize, Spinach, Cabbage"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold">Existing Livestock (comma separated)</label>
                  <input
                    type="text"
                    value={formLivestockText}
                    onChange={(e) => setFormLivestockText(e.target.value)}
                    placeholder="Nguni Cattle, Boer Goats"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
              </div>

              <InteractiveFarmMap
                latitude={modalSpatial?.latitude ?? selectedDistrictObj?.center.lat ?? -28.4793}
                longitude={modalSpatial?.longitude ?? selectedDistrictObj?.center.lng ?? 24.6727}
                locationSource={modalSpatial?.locationSource || 'municipal_center'}
                gpsLatitude={modalSpatial?.gpsLatitude}
                gpsLongitude={modalSpatial?.gpsLongitude}
                gpsAccuracyMeters={modalSpatial?.gpsAccuracyMeters}
                gpsCapturedAt={modalSpatial?.gpsCapturedAt}
                boundary={modalSpatial?.boundaryGeojson || null}
                onSpatialChange={setModalSpatial}
                title="GPS Location, Manual Pin & Boundary Editor"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFarmModalMode(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#D4DDD2] font-semibold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFarm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white font-semibold text-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingFarm ? 'Saving...' : 'Save Farm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Farm Confirmation Modal */}
      {deleteTargetFarm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[#8E2424]">
              Confirm Farm Deletion
            </h3>
            <p className="text-sm text-[#35443B]">
              Are you sure you want to delete <span className="font-semibold">{deleteTargetFarm.name}</span>? This permanently removes its location, spatial boundary, fields, crops, and livestock records.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetFarm(null)}
                className="px-4 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingFarm}
                onClick={confirmDeleteFarm}
                className="px-4 py-2.5 rounded-xl bg-[#8E2424] text-white text-sm font-semibold cursor-pointer"
              >
                {deletingFarm ? 'Deleting...' : 'Delete Farm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Field Modal (with Interactive Field Boundary Drawing) */}
      {fieldModalMode && activeFarm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326]">
                {fieldModalMode === 'create' ? 'Add New Field' : 'Edit Field & Map Boundary'}
              </h3>
              <button
                type="button"
                onClick={() => setFieldModalMode(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F3EF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Field / Camp Name</label>
                  <input
                    type="text"
                    required
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="e.g. South Pivot Block"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Crop or Livestock Enterprise</label>
                  <input
                    type="text"
                    required
                    value={fieldCrop}
                    onChange={(e) => setFieldCrop(e.target.value)}
                    placeholder="e.g. Yellow Maize or Nguni Grazing"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Area (ha)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={fieldArea}
                    onChange={(e) => setFieldArea(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Status</label>
                  <select
                    value={fieldStatus}
                    onChange={(e) =>
                      setFieldStatus(e.target.value as 'active' | 'fallow' | 'preparing')
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="preparing">Preparing</option>
                    <option value="fallow">Fallow</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Soil Type</label>
                  <input
                    type="text"
                    value={fieldSoil}
                    onChange={(e) => setFieldSoil(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Irrigation</label>
                  <input
                    type="text"
                    value={fieldIrrigation}
                    onChange={(e) => setFieldIrrigation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold">Notes</label>
                <textarea
                  rows={2}
                  value={fieldNotes}
                  onChange={(e) => setFieldNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D4DDD2]"
                />
              </div>

              {activeFarm.location && (
                <InteractiveFarmMap
                  latitude={activeFarm.location.latitude}
                  longitude={activeFarm.location.longitude}
                  boundary={fieldBoundary}
                  onSpatialChange={(sp) => setFieldBoundary(sp.boundaryGeojson)}
                  title="Draw Field Boundary (Optional)"
                />
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFieldModalMode(null)}
                  className="px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingField}
                  className="px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
                >
                  {savingField ? 'Saving...' : 'Save Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

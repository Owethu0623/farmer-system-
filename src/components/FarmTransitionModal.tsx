import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';
import { transitionFarmerToExisting } from '../lib/api';
import {
  AuthUser,
  BusinessPlanScenarioItem,
  FarmItem,
  FarmTenureRelationship,
  GeoJsonPolygon,
  LocationSource,
  ProvinceInfo,
  SavedProspectiveLocationItem,
} from '../types';
import { InteractiveFarmMap, SpatialUpdatePayload } from './InteractiveFarmMap';

interface FarmTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  provinces: ProvinceInfo[];
  savedLocations?: SavedProspectiveLocationItem[];
  savedPlans?: BusinessPlanScenarioItem[];
  onTransitionSuccess: (updatedUser: AuthUser, newFarm: FarmItem, linkedPlansCount: number) => void;
}

const TENURE_OPTIONS: {
  value: FarmTenureRelationship;
  label: string;
  description: string;
}[] = [
  {
    value: 'owner',
    label: 'Farm Owner (Registered / Self-Reported)',
    description: 'You own the farmland directly or hold a family title deed.',
  },
  {
    value: 'lessee',
    label: 'Leaseholder / Tenant Farmer',
    description: 'You lease or rent the land under a private or state lease agreement.',
  },
  {
    value: 'manager',
    label: 'Farm Manager / Operational Lead',
    description: 'You manage daily farming operations on behalf of an owner or trust.',
  },
  {
    value: 'communal_custodian',
    label: 'Communal / Traditional Land Custodian',
    description: 'You farm allocated communal or PTO land.',
  },
  {
    value: 'family_land',
    label: 'Family Land Partner',
    description: 'You operate a production block on shared family land.',
  },
];

const FARMING_ACTIVITY_OPTIONS = [
  'Maize / Grain Crops',
  'Vegetables & Leafy Greens',
  'Dry Beans / Legumes',
  'Poultry (Broilers / Layers)',
  'Cattle / Beef / Dairy',
  'Sheep / Goats',
  'Mixed Crop-Livestock',
  'Fruit / Citrus Orchards',
];

export const FarmTransitionModal: React.FC<FarmTransitionModalProps> = ({
  isOpen,
  onClose,
  user,
  provinces,
  savedLocations = [],
  savedPlans = [],
  onTransitionSuccess,
}) => {
  const defaultProvince =
    savedLocations[0]?.province || user.profile?.province || provinces[0]?.name || 'Free State';
  const matchedProv = provinces.find((p) => p.name === defaultProvince) || provinces[0];

  const [farmName, setFarmName] = useState(
    savedLocations[0] ? `${savedLocations[0].townOrArea} Farm` : ''
  );
  const [province, setProvince] = useState(defaultProvince);
  const [districtMunicipality, setDistrictMunicipality] = useState(
    savedLocations[0]?.district ||
      user.profile?.district ||
      matchedProv?.districts[0]?.name ||
      ''
  );
  const [localMunicipality, setLocalMunicipality] = useState(
    savedLocations[0]?.townOrArea || ''
  );
  const [townOrVillage, setTownOrVillage] = useState(savedLocations[0]?.townOrArea || '');
  const [farmSizeHectares, setFarmSizeHectares] = useState(
    String(
      savedLocations[0]?.intendedHectares ||
        user.profile?.prospectiveData?.intendedLandSizeHectares ||
        5
    )
  );
  const [waterAvailability, setWaterAvailability] = useState(
    savedLocations[0]?.waterSourceNote || 'Borehole & Storage Tank'
  );
  const [yearsOfExperience, setYearsOfExperience] = useState(
    String(user.profile?.farmerExperienceYears || 1)
  );
  const [tenureType, setTenureType] = useState<FarmTenureRelationship>('owner');
  const [managementRelationshipNote, setManagementRelationshipNote] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(
    user.profile?.prospectiveData?.preferredFarmingType
      ? [user.profile.prospectiveData.preferredFarmingType]
      : ['Vegetables & Leafy Greens']
  );
  const [linkedPlanIds, setLinkedPlanIds] = useState<string[]>(
    savedPlans.slice(0, 2).map((p) => p.id)
  );

  const [spatial, setSpatial] = useState<SpatialUpdatePayload>({
    latitude: matchedProv?.centerLat ?? -28.4793,
    longitude: matchedProv?.centerLng ?? 24.6727,
    locationSource: 'manual_map_pin',
    locationDescription: '',
    locationConfirmed: false,
    gpsLatitude: null,
    gpsLongitude: null,
    gpsAccuracyMeters: null,
    gpsCapturedAt: null,
    boundaryGeojson: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeProv = provinces.find((p) => p.name === province);
  const districts = (activeProv?.districts || []).map((d) => d.name);

  const handleProvinceChange = (newProvName: string) => {
    setProvince(newProvName);
    const p = provinces.find((item) => item.name === newProvName);
    if (p) {
      setDistrictMunicipality(p.districts[0]?.name || '');
      setSpatial((prev) => ({
        ...prev,
        latitude: p.centerLat,
        longitude: p.centerLng,
        locationSource: 'municipal_center',
        locationConfirmed: false,
      }));
    }
  };

  const applySavedCandidateLocation = (locId: string) => {
    const loc = savedLocations.find((l) => l.id === locId);
    if (!loc) return;
    setProvince(loc.province);
    setDistrictMunicipality(loc.district);
    setLocalMunicipality(loc.townOrArea);
    setTownOrVillage(loc.townOrArea);
    setFarmSizeHectares(String(loc.intendedHectares || 5));
    if (loc.waterSourceNote) setWaterAvailability(loc.waterSourceNote);
    if (!farmName.trim()) setFarmName(`${loc.townOrArea} Farm`);
    const p = provinces.find((item) => item.name === loc.province);
    if (p) {
      setSpatial((prev) => ({
        ...prev,
        latitude: p.centerLat,
        longitude: p.centerLng,
      }));
    }
  };

  const toggleActivity = (act: string) => {
    setSelectedActivities((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]
    );
  };

  const togglePlan = (planId: string) => {
    setLinkedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!farmName.trim() || !townOrVillage.trim() || !districtMunicipality.trim()) {
      setError('Please enter your farm name, district municipality, and town or village.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await transitionFarmerToExisting({
        farmName: farmName.trim(),
        province,
        districtMunicipality: districtMunicipality.trim(),
        localMunicipality: (localMunicipality || townOrVillage).trim(),
        townOrVillage: townOrVillage.trim(),
        locationDescription: spatial.locationDescription,
        locationConfirmed: spatial.locationConfirmed,
        latitude: spatial.latitude,
        longitude: spatial.longitude,
        locationSource: spatial.locationSource as LocationSource,
        gpsLatitude: spatial.gpsLatitude,
        gpsLongitude: spatial.gpsLongitude,
        gpsAccuracyMeters: spatial.gpsAccuracyMeters,
        gpsCapturedAt: spatial.gpsCapturedAt,
        farmSizeHectares: Number(farmSizeHectares) || 1,
        farmingActivities:
          selectedActivities.length > 0 ? selectedActivities : ['Mixed Farming'],
        yearsOfExperience: Number(yearsOfExperience) || 0,
        waterAvailability,
        tenureType,
        managementRelationshipNote: managementRelationshipNote.trim(),
        linkedBusinessPlanIds: linkedPlanIds,
        boundaryGeojson: spatial.boundaryGeojson as GeoJsonPolygon | null,
      });

      onTransitionSuccess(res.user, res.farm, res.linkedPlansCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register farm transition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-transition-modal-title"
    >
      <div className="bg-white border border-slate-300 rounded-md shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 bg-[#0B1F3A] text-white shrink-0">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              Account Journey Progression · Same Account & History Preserved
            </div>
            <h2 id="farm-transition-modal-title" className="text-lg font-bold mt-0.5">
              Register Your Farm & Transition to Existing Farmer Workspace
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 overflow-y-auto space-y-5">
          <div className="p-3.5 rounded border border-emerald-300 bg-emerald-50 text-xs text-emerald-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <div>
              <strong>Everything you prepared stays with your account:</strong> Your login email ({user.email}), language preference, saved candidate locations, business plans, learning completions, and AI advisor history remain intact. This action unlocks operational farm management (fields, crops, livestock, stock values, incidents, and farm reports) and can be reversed later from Profile Settings without deleting data.
            </div>
          </div>

          {savedLocations.length > 0 && (
            <div className="p-3 rounded border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-semibold text-[#0B1F3A]">
                Pre-fill from a Saved Candidate Location (Optional):
              </div>
              <div className="flex flex-wrap gap-2">
                {savedLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => applySavedCandidateLocation(loc.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-medium text-[#0B1F3A] hover:bg-slate-100"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#0B3D91]" />
                    <span>
                      {loc.townOrArea}, {loc.province} ({loc.intendedHectares} ha)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Core Farm Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Farm Name *
              </label>
              <input
                type="text"
                required
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="e.g., Thaba Nchu Mixed Farm"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Province *
              </label>
              <select
                value={province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
              >
                {provinces.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                District Municipality *
              </label>
              {districts.length > 0 ? (
                <select
                  value={districtMunicipality}
                  onChange={(e) => setDistrictMunicipality(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
                >
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  {!districts.includes(districtMunicipality) && districtMunicipality && (
                    <option value={districtMunicipality}>{districtMunicipality}</option>
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={districtMunicipality}
                  onChange={(e) => setDistrictMunicipality(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Local Municipality
              </label>
              <input
                type="text"
                value={localMunicipality}
                onChange={(e) => setLocalMunicipality(e.target.value)}
                placeholder="e.g., Mangaung Metro"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nearest Town / Village *
              </label>
              <input
                type="text"
                required
                value={townOrVillage}
                onChange={(e) => setTownOrVillage(e.target.value)}
                placeholder="e.g., Botshabelo"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Farm Size (Hectares) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={farmSizeHectares}
                onChange={(e) => setFarmSizeHectares(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Water Availability *
              </label>
              <input
                type="text"
                required
                value={waterAvailability}
                onChange={(e) => setWaterAvailability(e.target.value)}
                placeholder="e.g., Borehole & 10,000L tank"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Years of Practical Experience
              </label>
              <input
                type="number"
                min="0"
                max="80"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-slate-900"
              />
            </div>
          </div>

          {/* Ownership vs Management Relationship */}
          <div className="p-4 rounded border border-slate-300 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1F3A]">
              <Building2 className="w-4 h-4 text-[#0B3D91]" />
              <span>Farm Ownership or Management Relationship (Self-Declared)</span>
            </div>
            <p className="text-xs text-slate-600">
              Select how you operate this farmland. Field Shift records your declared relationship without claiming Deeds Office verification.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TENURE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`p-2.5 rounded border cursor-pointer text-xs flex items-start gap-2 ${
                    tenureType === opt.value
                      ? 'border-[#0B1F3A] bg-white ring-1 ring-[#0B1F3A]'
                      : 'border-slate-300 bg-white/70 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="tenureType"
                    value={opt.value}
                    checked={tenureType === opt.value}
                    onChange={() => setTenureType(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-[#0B1F3A]">{opt.label}</div>
                    <div className="text-slate-600 mt-0.5">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Tenure / Management Note (e.g. Lease term or Plot reference)
              </label>
              <input
                type="text"
                maxLength={280}
                value={managementRelationshipNote}
                onChange={(e) => setManagementRelationshipNote(e.target.value)}
                placeholder="e.g., 5-year municipal lease starting 2026, Portion 3"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Farming Activities */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-[#0B1F3A] flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-700" />
              <span>Initial Farming Activities</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FARMING_ACTIVITY_OPTIONS.map((act) => {
                const active = selectedActivities.includes(act);
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => toggleActivity(act)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border ${
                      active
                        ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {act}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Link Existing Business Plans */}
          {savedPlans.length > 0 && (
            <div className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[#0B1F3A]">
                Link Saved Business Plans to This Farm ({linkedPlanIds.length} selected)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {savedPlans.map((plan) => {
                  const checked = linkedPlanIds.includes(plan.id);
                  return (
                    <label
                      key={plan.id}
                      className="flex items-start gap-2 p-2 rounded border border-slate-300 bg-white text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlan(plan.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0B1F3A] truncate">
                          {plan.planName}
                        </div>
                        <div className="text-slate-600">
                          {plan.farmingType} · {plan.farmSizeHectares} ha · {plan.province}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spatial Coordinates & Optional Boundary */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-[#0B1F3A]">
              Exact Farm Location (GPS / Map Pin / Search) & Optional Boundary
            </div>
            <InteractiveFarmMap
              latitude={spatial.latitude}
              longitude={spatial.longitude}
              locationSource={spatial.locationSource}
              locationDescription={spatial.locationDescription}
              locationConfirmed={spatial.locationConfirmed}
              gpsLatitude={spatial.gpsLatitude}
              gpsLongitude={spatial.gpsLongitude}
              gpsAccuracyMeters={spatial.gpsAccuracyMeters}
              gpsCapturedAt={spatial.gpsCapturedAt}
              boundary={spatial.boundaryGeojson}
              onSpatialChange={setSpatial}
              title="Set Real Farm Coordinates"
            />
          </div>

          {error && (
            <div className="p-3 rounded border border-red-300 bg-red-50 text-sm text-red-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded bg-emerald-800 text-white text-sm font-semibold hover:bg-emerald-900 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>
                {submitting ? 'Transitioning Account...' : 'Complete Transition & Open Farm Workspace'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

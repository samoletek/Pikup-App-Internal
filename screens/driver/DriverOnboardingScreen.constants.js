import { colors } from '../../styles/theme';
import { links } from '../../constants/links';

export const steps = [
  {
    title: 'Welcome to PikUp',
    subtitle: 'Watch this short video to learn how PikUp works',
    icon: 'videocam',
    color: colors.primary,
  },
  {
    title: 'Identity Verification',
    subtitle: 'We need to verify your identity to ensure safety',
    icon: 'shield-checkmark',
    color: colors.success,
  },
  {
    title: 'Personal Info',
    subtitle: 'Tell us a bit about yourself',
    icon: 'person',
    color: colors.warning,
  },
  {
    title: 'Address',
    subtitle: 'Where do you live?',
    icon: 'location',
    color: colors.secondary,
  },
  {
    title: 'Vehicle Info',
    subtitle: 'Verify your vehicle with photos',
    icon: 'car',
    color: colors.info,
  },
  {
    title: 'Payment Setup',
    subtitle: 'How you get paid',
    icon: 'card',
    color: colors.primary,
  },
];

export const US_STATES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
];

export const ONBOARDING_VIDEO_WATCHED_KEY = 'driver_onboarding_video_watched';
export const ONBOARDING_DRAFT_STORAGE_PREFIX = 'driver_onboarding_draft_v1';
export const VALID_VERIFICATION_STATUSES = ['pending', 'processing', 'completed', 'failed', 'canceled'];
export const WEBSITE_URL = links.website;

export const initialFormData = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  dateOfBirth: '',
  ssn: '',
  address: {
    line1: '',
    city: '',
    state: '',
    postalCode: '',
  },
  vehicleInfo: {
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    color: '',
    vin: '',
  },
};

// Claims Empty State component: renders its UI and handles related interactions.
import React from 'react';
import AppListEmpty from '../ui/AppListEmpty';

export default function ClaimsEmptyState({ activeTab }) {
  return (
    <AppListEmpty
      title={activeTab === 'ongoing' ? 'No ongoing claims' : 'No completed claims'}
      subtitle="Claims can only be filed for deliveries with insurance coverage"
      iconName="document-text-outline"
    />
  );
}

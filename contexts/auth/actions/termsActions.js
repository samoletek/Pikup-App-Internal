import * as TermsService from '../../../services/TermsService';

export const createTermsDomainActions = ({ currentUser }) => {
  return {
    getLegalConfig: TermsService.getLegalConfig,
    checkTermsAcceptance: TermsService.checkTermsAcceptance,
    acceptTerms: TermsService.acceptTerms,
    getTermsStatus: (uid) => TermsService.getTermsStatus(uid, currentUser),
  };
};

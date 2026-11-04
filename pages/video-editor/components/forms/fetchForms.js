/**
 * External dependencies
 */
import { getLayerVariationByName, isVariationAvailable } from '@godam/layers';

/**
 * Internal dependencies
 */
import { useGetGravityFormsQuery } from '../../redux/api/gravity-forms';
import { useGetWPFormsQuery } from '../../redux/api/wpforms';
import { useGetCF7FormsQuery } from '../../redux/api/cf7-forms';
import { useGetJetpackFormsQuery } from '../../redux/api/jetpack-forms';
import { useGetSureformsQuery } from '../../redux/api/sureforms';
import { useGetForminatorFormsQuery } from '../../redux/api/forminator-forms';
import { useGetFluentFormsQuery } from '../../redux/api/fluent-forms';
import { useGetEverestFormsQuery } from '../../redux/api/everest-forms';
import { useGetNinjaFormsQuery } from '../../redux/api/ninja-forms';
import { useGetMetformsQuery } from '../../redux/api/metform';
import { useGetHubspotFormsQuery } from '../../redux/api/hubspot-forms';
import { useGetMarketoFormsQuery } from '../../redux/api/marketo-forms';

// GoDAM's own providers fetch their form lists here; a provider that isn't
// registered or whose plugin is inactive is skipped.
const isProviderAvailable = ( name ) => {
	const provider = getLayerVariationByName( 'form', name );
	return Boolean( provider ) && isVariationAvailable( provider );
};

export const useFetchForms = () => {
	const { data: cf7Forms = [], isFetching: isFetchingCF7 = false } = useGetCF7FormsQuery( undefined, {
		skip: ! isProviderAvailable( 'cf7' ),
	} );
	const { data: gravityForms = [], isFetching: isFetchingGravity = false } = useGetGravityFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'gravity' ),
	} );
	const { data: wpForms = [], isFetching: isFetchingWPForms = false } = useGetWPFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'wpforms' ),
	} );
	const { data: jetpackForms = [], isFetching: isFetchingJetpack = false } = useGetJetpackFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'jetpack' ),
	} );
	const { data: sureforms = [], isFetching: isFetchingSureforms = false } = useGetSureformsQuery( undefined, {
		skip: ! isProviderAvailable( 'sureforms' ),
	} );
	const { data: forminatorForms = [], isFetching: isFetchingForminator = false } = useGetForminatorFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'forminator' ),
	} );
	const { data: fluentForms = [], isFetching: isFetchingFluentForms = false } = useGetFluentFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'fluentforms' ),
	} );
	const { data: everestForms = [], isFetching: isFetchingEverestForms = false } = useGetEverestFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'everestforms' ),
	} );

	const { data: ninjaForms = [], isFetching: isFetchingNinjaForms = false } = useGetNinjaFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'ninjaforms' ),
	} );
	const { data: metforms = [], isFetching: isFetchingMetforms = false } = useGetMetformsQuery( undefined, {
		skip: ! isProviderAvailable( 'metform' ),
	} );
	const { data: hubspotForms = [], isFetching: isFetchingHubspotForms = false } = useGetHubspotFormsQuery( undefined, {
		skip: ! isProviderAvailable( 'hubspot' ),
	} );
	// The Marketo layer is always offered (a typed form ID works without a list),
	// so gate the list on the connection itself.
	const { data: marketoForms = [], isFetching: isFetchingMarketoForms = false } = useGetMarketoFormsQuery( undefined, {
		skip: ! window?.videoData?.marketoActive,
	} );

	const isFetching =
		isFetchingCF7 ||
		isFetchingGravity ||
		isFetchingWPForms ||
		isFetchingJetpack ||
		isFetchingSureforms ||
		isFetchingForminator ||
		isFetchingFluentForms ||
		isFetchingEverestForms ||
		isFetchingNinjaForms ||
		isFetchingMetforms ||
		isFetchingHubspotForms ||
		isFetchingMarketoForms;

	return {
		cf7Forms,
		gravityForms,
		wpForms,
		jetpackForms,
		sureforms,
		forminatorForms,
		fluentForms,
		everestForms,
		ninjaForms,
		metforms,
		hubspotForms,
		marketoForms,
		isFetching,
	};
};

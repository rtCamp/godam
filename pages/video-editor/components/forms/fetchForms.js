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
import { FormLayerComponentType } from '../layers/FormLayer';
import { useGetMetformsQuery } from '../../redux/api/metform';

export const useFetchForms = () => {
	const { data: cf7Forms = [], isFetching: isFetchingCF7 = false } = useGetCF7FormsQuery( undefined, {
		skip: ! FormLayerComponentType?.cf7.isActive,
	} );
	const { data: gravityForms = [], isFetching: isFetchingGravity = false } = useGetGravityFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.gravity.isActive,
	} );
	const { data: wpForms = [], isFetching: isFetchingWPForms = false } = useGetWPFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.wpforms.isActive,
	} );
	const { data: jetpackForms = [], isFetching: isFetchingJetpack = false } = useGetJetpackFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.jetpack.isActive,
	} );
	const { data: sureforms = [], isFetching: isFetchingSureforms = false } = useGetSureformsQuery( undefined, {
		skip: ! FormLayerComponentType?.sureforms.isActive,
	} );
	const { data: forminatorForms = [], isFetching: isFetchingForminator = false } = useGetForminatorFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.forminator.isActive,
	} );
	const { data: fluentForms = [], isFetching: isFetchingFluentForms = false } = useGetFluentFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.fluentforms.isActive,
	} );
	const { data: everestForms = [], isFetching: isFetchingEverestForms = false } = useGetEverestFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.everestforms.isActive,
	} );
	const { data: ninjaForms = [], isFetching: isFetchingNinjaForms = false } = useGetNinjaFormsQuery( undefined, {
		skip: ! FormLayerComponentType?.ninjaforms.isActive,
	} );
	const { data: metforms = [], isFetching: isFetchingMetforms = false } = useGetMetformsQuery( undefined, {
		skip: ! FormLayerComponentType?.metform.isActive,
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
		isFetchingMetforms;

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
		isFetching,
	};
};

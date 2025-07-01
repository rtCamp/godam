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

export const useFetchForms = () => {
	const { data: cf7Forms, isFetching: isFetchingCF7 } = useGetCF7FormsQuery();
	const { data: gravityForms, isFetching: isFetchingGravity } = useGetGravityFormsQuery();
	const { data: wpForms, isFetching: isFetchingWPForms } = useGetWPFormsQuery();
	const { data: jetpackForms, isFetching: isFetchingJetpack } = useGetJetpackFormsQuery();
	const { data: sureforms, isFetching: isFetchingSureforms } = useGetSureformsQuery();
	const { data: forminatorForms, isFetching: isFetchingForminator } = useGetForminatorFormsQuery();
	const { data: fluentForms, isFetching: isFetchingFluentForms } = useGetFluentFormsQuery();
	const { data: everestForms, isFetching: isFetchingEverestForms } = useGetEverestFormsQuery();

	const isFetching =
		isFetchingCF7 ||
		isFetchingGravity ||
		isFetchingWPForms ||
		isFetchingJetpack ||
		isFetchingSureforms ||
		isFetchingForminator ||
		isFetchingFluentForms ||
		isFetchingEverestForms;

	return {
		cf7Forms,
		gravityForms,
		wpForms,
		jetpackForms,
		sureforms,
		forminatorForms,
		fluentForms,
		everestForms,
		isFetching,
	};
};

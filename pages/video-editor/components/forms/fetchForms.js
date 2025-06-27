/**
 * Internal dependencies
 */
import { useGetGravityFormsQuery } from '../../redux/api/gravity-forms';
import { useGetWPFormsQuery } from '../../redux/api/wpforms';
import { useGetCF7FormsQuery } from '../../redux/api/cf7-forms';
import { useGetJetpackFormsQuery } from '../../redux/api/jetpack-forms';
import { useGetSureformsQuery } from '../../redux/api/sureforms';
import { useGetFluentFormsQuery } from '../../redux/api/fluent-forms';

export const useFetchForms = () => {
	const { data: cf7Forms, isFetching: isFetchingCF7 } = useGetCF7FormsQuery();
	const { data: gravityForms, isFetching: isFetchingGravity } = useGetGravityFormsQuery();
	const { data: wpForms, isFetching: isFetchingWPForms } = useGetWPFormsQuery();
	const { data: jetpackForms, isFetching: isFetchingJetpack } = useGetJetpackFormsQuery();
	const { data: sureforms, isFetching: isFetchingSureforms } = useGetSureformsQuery();
	const { data: fluentForms, isFetching: isFetchingFluentForms } = useGetFluentFormsQuery();

	const isFetching =
		isFetchingCF7 ||
		isFetchingGravity ||
		isFetchingWPForms ||
		isFetchingJetpack ||
		isFetchingSureforms ||
		isFetchingFluentForms;

	return {
		cf7Forms,
		gravityForms,
		wpForms,
		jetpackForms,
		sureforms,
		fluentForms,
		isFetching,
	};
};

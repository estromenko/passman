/**
 * Nextcloud - passman
 *
 * @copyright Copyright (c) 2016, Sander Brand (brantje@gmail.com)
 * @copyright Copyright (c) 2016, Marcos Zuriaga Miguel (wolfi@wolfi.es)
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function () {
	'use strict';


	/**
	 * @ngdoc function
	 * @name passmanApp.controller:MenuCtrl
	 * @description
	 * # MenuCtrl
	 * Controller of the passmanApp
	 */
	angular.module('passmanApp')
		.controller('GenericCsvImportCtrl', ['$scope', 'CredentialService', 'FileService', 'EncryptService', '$translate', '$q',
			function ($scope, CredentialService, FileService, EncryptService, $translate, $q) {
				$scope.hello = 'world';

				$scope.credentialProperties = [
					{
						label: 'Label',
						prop: 'label',
						matching: ['label', 'title', 'name']
					},
					{
						label: 'Username',
						prop: 'username',
						matching: ['username', 'user', 'login', 'login name']
					},
					{
						label: 'Password',
						prop: 'password',
						matching: ['password', 'pass', 'pw']
					},
					{
						label: 'TOTP Secret',
						prop: 'otp',
						matching: ['totp']
					},
					{
						label: 'Custom field',
						prop: 'custom_field'
					},
					{
						label: 'Custom fields',
						prop: 'custom_fields',
						matching: ['custom_fields', 'customFields']
					},
					{
						label: 'Files',
						prop: 'files',
						matching: ['files']
					},
					{
						label: 'Notes',
						prop: 'description',
						matching: ['notes', 'description', 'comments']
					},
					{
						label: 'Email',
						prop: 'email',
						matching: ['email', 'mail']
					},
					{
						label: 'URL',
						prop: 'url',
						matching: ['website', 'url', 'fulladdress', 'site', 'web site']
					},
					{
						label: 'Tags',
						prop: 'tags'
					},
					{
						label: 'Ignored',
						prop: null
					}
				];
				var tagMapper = function (t) {
					return {text: t};
				};
				var rowToCredential = async function (row) {
					var _credential = PassmanImporter.newCredential();
					for(var k = 0; k < $scope.import_fields.length; k++){
						var field = $scope.import_fields[k];
						if(field){
							if(field === 'otp'){
								_credential.otp.secret = row[k];
							} else if(field === 'custom_field'){
								var key = ($scope.matched) ? $scope.parsed_csv[0][k] : 'Custom field '+ k;
								_credential.custom_fields.push({
									'label': key,
									'value': row[k],
									'secret': 0
								});
							} else if(field === 'custom_fields'){
								if (row[k] !== undefined && (typeof row[k] === 'string' || row[k] instanceof String) && row[k].length > 1){
									try {
										row[k] = JSON.parse(row[k]);
										for(let i = 0; k < row[k].length; i++){
											_credential.custom_fields.push({
												'label': row[k][i].label,
												'secret': row[k][i].secret,
												'field_type': row[k][i].field_type,
											});
										}
									} catch (e) {
										// ignore row[k], it contains no valid json data
										// console.error(e);
									}
								} else {
									for(let j = 0; j < row[k].length; j++){
										if (row[k][j].field_type === 'file'){
											var _file = {
												filename: row[k][j].value.filename,
												size: row[k][j].value.size,
												mimetype: row[k][j].value.mimetype,
												data: row[k][j].value.file_data
											};

											row[k][j].value = await FileService.uploadFile(_file).then(FileService.getEmptyFileWithDecryptedFilename);
										}
										_credential.custom_fields.push(row[k][j]);
									}
								}
							} else if(field === 'files'){
								if (row[k] !== undefined && (typeof row[k] === 'string' || row[k] instanceof String) && row[k].length > 1){
									try {
										row[k] = JSON.parse(row[k]);
										for(let i = 0; k < row[k].length; i++){
											_credential.files.push({
												filename: row[k][i].filename,
												size: row[k][i].size,
												mimetype: row[k][i].mimetype
											});
										}
									} catch (e) {
										// ignore row[k], it contains no valid json data
										// console.error(e);
									}
								} else {
									for(let j = 0; j < row[k].length; j++){
										_credential.files.push(await FileService.uploadFile({
											filename: row[k][j].filename,
											size: row[k][j].size,
											mimetype: row[k][j].mimetype,
											data: row[k][j].file_data
										}).then(FileService.getEmptyFileWithDecryptedFilename));
									}
								}
							} else if(field === 'tags'){
								if( row[k]) {
									var tags = row[k].split(',');
									_credential.tags = tags.map(tagMapper);
								}
							} else{
								_credential[field] = row[k];
							}
						}
					}
					return _credential;
				};


				$scope.inspectCredential = function (row) {
					$scope.inspected_credential = rowToCredential(row);
				};

				$scope.csvLoaded = function (file) {
					$scope.import_fields = [];
					$scope.inspected_credential = false;
					$scope.matched = false;
					var file_data = file.data.split(',');
					file_data = decodeURIComponent(escape(window.atob(file_data[1])));
					/** global: Papa */
					Papa.parse(file_data, {
						complete: function(results) {
							if(results.data) {
								for(var i = 0; i < results.data[0].length; i++){
									var propName = results.data[0][i];
									$scope.import_fields[i] = null;
									for(var p = 0; p < $scope.credentialProperties.length; p++){
										var credentialProperty = $scope.credentialProperties[p];
										if(credentialProperty.matching){
											if(credentialProperty.matching.indexOf(propName.toLowerCase()) !== -1){
												$scope.import_fields[i] = credentialProperty.prop;
												$scope.matched = true;
											}
										}
									}
								}
								if($scope.matched){
									$scope.inspectCredential(results.data[1]);
								}

								for(var j = 0; j < results.data.length; j++){
									if (results.data[j].length === 1 && results.data[j][0].length === 0) {
										results.data.splice(j,j);
									}
								}
								$scope.parsed_csv = results.data;
								$scope.$apply();
							}
						}
					});
				};

				var addCredential = async function (index) {
					function handleState (index) {
						if ($scope.parsed_csv[index + 1]) {
							$scope.import_progress = {
								progress: index / $scope.parsed_csv.length * 100,
								loaded: index,
								total: $scope.parsed_csv.length
							};

							addCredential(index + 1);
						} else {
							$scope.import_progress = {
								progress: 100,
								loaded: $scope.parsed_csv.length,
								total: $scope.parsed_csv.length
							};
							$scope.log.push($translate.instant('done'));
							$scope.importing = false;
						}
					}

					var _credential = await rowToCredential($scope.parsed_csv[index]);
					_credential.vault_id = $scope.active_vault.vault_id;
					if (!_credential.label) {
						$scope.log.push($translate.instant('import.skipping', {line: index}));
						handleState(index);
						return;
					}
					$scope.log.push($translate.instant('import.adding', {credential: _credential.label}));
					CredentialService.createCredential(_credential).then(function (result) {
						if (result.credential_id) {
							$scope.log.push($translate.instant('import.added', {credential: _credential.label}));
							handleState(index);
						}
					});
				};

				$scope.skipFirstRow = true;
				$scope.importing = false;
				$scope.startCSVImport = function () {
					$scope.importing = true;
					$scope.log = [];
					var start = ($scope.skipFirstRow) ? 1 : 0;
					addCredential(start);
				};

				$scope.updateExample = function () {
					var start = ($scope.skipFirstRow) ? 1 : 0;
					$scope.inspectCredential($scope.parsed_csv[start]);
				};
			}]);
}());


function APUtil(Vault, controller, editor) {

	this.Vault = Vault;
	this.controller = controller;
	this.editor = editor;
	this.GLAccountList = "";
	this.GLAccountArr = [];
	this.TaxCodeArr = [];
	this.TaxInfoArr = [];

	this.GetText = function (id) {
		switch (id) {
			case id = "IDS_METADATACARD_COMMAND_SAVE": id = 27593; break;
			case id = "IDS_METADATACARD_BUTTON_DISCARD": id = 27614; break;
			case id = "IDS_METADATACARD_BUTTON_TOOLTIP_SAVE": id = 27929; break;
		}

		// Get localized text from MFShell.
		var localizedString = null;
		try {
			localizedString = MFiles.GetStringResource(id);
		}
		catch (ex) {
		}
		return (localizedString != null) ? localizedString : "";
	};

	this.toggleButton = function (val) {
		$("#save-data, #discard-data").toggleClass("ui-state-hidden", val);
	};

	var saveLabel = this.GetText("IDS_METADATACARD_COMMAND_SAVE");
	var saveTooltip = this.GetText("IDS_METADATACARD_BUTTON_TOOLTIP_SAVE");
	var discardLabel = this.GetText("IDS_METADATACARD_BUTTON_DISCARD");

	$("#save-data").button({ label: saveLabel });
	$("#save-data").attr("title", saveTooltip);
	$("#discard-data").button({ label: discardLabel });

	$(".btn").mouseenter(function () {
		$(this).css("background", "#7ecaf0");
	}).mouseleave(function () { $(this).css("background", "#318CCC"); });

	$('li.gl').on('click', function (no) {
		var content = $(this).text();
		var val = content.split("-");
		$('#GLAccount' + no).val(val[0].trim());
		document.getElementById("GLOption").style.display = "none";
	});

	$(window).resize(function () {
		gUtil.ResizeContentArea();
	});

	this.toggleButton(true);

	this.GetColIndex = function (pptName) {

		if (pptName == "ItemNumber" || pptName == "ItemDescription") return 1;
		else if (pptName == "Quantity") return 2;
		else if (pptName == "UnitPrice") return 3;
		else if (pptName == "InvoiceLineExtension") return 4;
		else if (pptName == "TaxCode") return 5;
		else if (pptName == "Tax") return 6;
		else if (pptName == "PONumber") return 7;
		else if (pptName == "GLAccount") return 8;
	}

	this.DestroyOldDetails = function () {
		var ci = controller.Invoice;
		var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault, 'vObject.InvoiceDetail', 'vProperty.Invoice', MFDatatypeLookup, ci.ObjectVersion.ObjVer.ID), MFSearchFlagNone, true);

		for (var k = 0; k < ObjectSearchResults.count; k++) {
			var objID = new MFiles.ObjID();
			objID.SetIDs(ObjectSearchResults[k].ObjVer.Type, ObjectSearchResults[k].ObjVer.ID);
			Vault.ObjectOperations.DestroyObject(objID, true, -1);
		}
	}

	this.DuplicatedPOValue = function () {
		var arrPOVal = [];
		var tbl = document.getElementById('invoice_details_table');
		var tblCount = tbl.rows.length - 2;
		for (var i = 0; i < tblCount; i++) {

			var POVal = tbl.rows[i + 1].cells[this.GetColIndex("PONumber")].querySelector('input').value;
			if (POVal.trim() != "")
				arrPOVal.push(POVal.trim());
		}
		let counts = {};
		for (var i = 0; i < arrPOVal.length; i++) {
			if (counts[arrPOVal[i]] === undefined) {
				counts[arrPOVal[i]] = 1;
			} else {
				alert("PO# is duplicated");
				return true;
			}
		}

		return false;
	}

	this.GetPropertyValue = function (pptName, no) {

		var tbl = document.getElementById('invoice_details_table');
		var propertyValue = new MFiles.PropertyValue();
		var VaultOp = Vault.PropertyDefOperations;

		var value = tbl.rows[no + 1].cells[this.GetColIndex(pptName)].querySelector('input').value;

		propertyValue.PropertyDef = VaultOp.GetPropertyDefIDByAlias("vProperty." + pptName);
		propertyValue.Value.SetValue(VaultOp.GetPropertyDef(propertyValue.PropertyDef).DataType, value);

		return propertyValue;
	}

	this.GetFreightPropertyValue = function (pptName) {

		var propertyValue = new MFiles.PropertyValue();
		var VaultOp = Vault.PropertyDefOperations;

		propertyValue.PropertyDef = VaultOp.GetPropertyDefIDByAlias("vProperty." + $("#" + pptName)[0].value);
		propertyValue.Value.SetValue(VaultOp.GetPropertyDef(propertyValue.PropertyDef).DataType, value);

		return propertyValue;
	}

	this.GetPOPropertyValue = function (no) {

		var tbl = document.getElementById('invoice_details_table');
		var value = tbl.rows[no + 1].cells[this.GetColIndex('PONumber')].querySelector('input').value;
		if (value.trim() === "") return null;

		value = parseInt(value);

		var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(controller.ObjectVersion.ObjVer);
		var PONO = ObjectVersionProperties.SearchForPropertyByAlias(gDashboard.Vault, "vProperty.POReference", true).Value.DisplayValue;

		if (PONO == "") return null;
		var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault, 'vObject.PurchaseOrderDetail', 'vProperty.PurchaseOrder', MFDatatypeText, PONO), MFSearchFlagNone, true);

		var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
		var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);

		var isFound = false;

		for (var i = 0; i < ObjectSearchResults.Count; i++) {
			var props = ObjectSearchResultsProperties[i];
			var PoLine = props.SearchForPropertyByAlias(Vault, "vProperty.POLine#", true).Value.DisplayValue;

			if (PoLine == value) {
				isFound = true;
				var SearchResult = ObjectSearchResults[i];

				var newLookup = new MFiles.Lookup();
				newLookup.ObjectType = SearchResult.ObjVer.Type;
				newLookup.Item = SearchResult.ObjVer.ID;
				newLookup.DisplayValue = SearchResult.DisplayID;

				var propertyValue = new MFiles.PropertyValue();
				var VaultOp = Vault.PropertyDefOperations;

				propertyValue.PropertyDef = VaultOp.GetPropertyDefIDByAlias("vProperty.PurchaseOrderDetail");
				propertyValue.Value.SetValue(VaultOp.GetPropertyDef(propertyValue.PropertyDef).DataType, newLookup);

				return propertyValue;
			}
		}

		if (!isFound) {
			alert("PO# is out of range");
			return -1;
		}
	}

	this.GetGLPropertyValue = function (no) {

		var tbl = document.getElementById('invoice_details_table');
		var value = tbl.rows[no + 1].cells[this.GetColIndex('GLAccount')].querySelector('select').value;

		if (value.trim() === "") return null;

		var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault, 'vObject.GLAccount', 'vProperty.GLAccountName', MFDatatypeText, value), MFSearchFlagNone, true);

		if (ObjectSearchResults.Count == 0) {
			alert("GL Account is not found");
			return null;
		}

		var newGL = new MFiles.Lookup();
		newGL.ObjectType = ObjectSearchResults[0].ObjVer.Type;
		newGL.Item = ObjectSearchResults[0].ObjVer.ID;
		newGL.DisplayValue = ObjectSearchResults[0].Title;

		var propertyValue = new MFiles.PropertyValue();
		var VaultOp = Vault.PropertyDefOperations;

		propertyValue.PropertyDef = VaultOp.GetPropertyDefIDByAlias("vProperty.GLAccount");
		propertyValue.Value.SetValue(VaultOp.GetPropertyDef(propertyValue.PropertyDef).DataType, newGL);

		return propertyValue;
	}

	this.CreateNewDetails = function () {

		var ci = controller.Invoice;
		if (this.DuplicatedPOValue()) return false;
		var actCount = document.getElementById('invoice_details_table').rows.length - 2;

		var t = $("#invoice_details_table")[0].innerHTML;
		//return;
		for (var i = 0; i < actCount; i++) {
			var propertyValues = new MFiles.PropertyValues();

			//set class
			var classID = ci.ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
			var propertyValue = new MFiles.PropertyValue();
			propertyValue.PropertyDef = MFBuiltInPropertyDefClass;
			propertyValue.Value.SetValue(MFDatatypeLookup, classID);
			propertyValues.Add(-1, propertyValue);

			// set Name or Title
			var propTitle = ci.ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefNameOrTitle);
			var propertyValue = new MFiles.PropertyValue();
			propertyValue.PropertyDef = MFBuiltInPropertyDefNameOrTitle;
			propertyValue.Value.SetValue(propTitle.TypedValue.DataType, propTitle.TypedValue.DisplayValue);
			propertyValues.Add(-1, propertyValue);

			// set Invoice - lookup
			var newInvoice = new MFiles.Lookup();
			newInvoice.ObjectType = MFBuiltInObjectTypeDocument;
			newInvoice.Item = ci.ObjectVersion.ObjVer.ID;
			newInvoice.DisplayValue = propTitle.TypedValue.DisplayValue;

			// set Invoice - properties
			var propertyValue = new MFiles.PropertyValue();
			propertyValue.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.Invoice");
			propertyValue.Value.SetValue(MFDatatypeLookup, newInvoice);
			propertyValues.Add(-1, propertyValue);

			// set InvoiceLineNumber
			var propertyValue = new MFiles.PropertyValue();
			propertyValue.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.InvoiceLineNumber");
			propertyValue.Value.SetValue(MFDatatypeInteger, i + 1);
			propertyValues.Add(-1, propertyValue);

			propertyValues.Add(-1, this.GetPropertyValue("ItemNumber", i));            //1150
			propertyValues.Add(-1, this.GetPropertyValue("ItemDescription", i));            //1150
			propertyValues.Add(-1, this.GetPropertyValue("Quantity", i));             //1151
			propertyValues.Add(-1, this.GetPropertyValue("UnitPrice", i));            //1154
			propertyValues.Add(-1, this.GetPropertyValue("InvoiceLineExtension", i)); //1157

			// set PO Details
			var POValues = this.GetPOPropertyValue(i);
			if (POValues == -1) return false;
			if (POValues != null) propertyValues.Add(-1, POValues);      //PO Details

			// set GL Account
			var GLValues = this.GetGLPropertyValue(i);
			if (GLValues != null) propertyValues.Add(-1, GLValues);      //GL Details

			// CreateNewObject
			var oObjectVersionAndProperties = Vault.ObjectOperations.CreateNewObject(
				Vault.ObjectTypeOperations.GetObjectTypeIDByAlias("vObject.InvoiceDetail"),
				propertyValues,
				MFiles.CreateInstance("SourceObjectFiles"),
				MFiles.CreateInstance("AccessControlList"));

			Vault.ObjectOperations.CheckIn(oObjectVersionAndProperties.ObjVer);
			this.UpdateInvoice();
		}
		return true;
	}

	this.UpdateInvoice = function () {
		var ci = controller.Invoice;
		var FreightCost = $("#FreightCost")[0].value.trim();
		var FreightTaxCode = $("#FreightTaxCode")[0].value.trim();
		if (FreightCost == "$") return;

		FreightCost = this.GetNumber(FreightCost);

		//FreightTaxCode
		var objID = new MFiles.ObjID();
		objID.SetIDs(ci.ObjectVersion.ObjVer.Type, ci.ObjectVersion.ObjVer.ID);
		var InvoiceObjVer = Vault.ObjectOperations.GetLatestObjVer(objID, false, true);
		var InvoiceoObjProperties = Vault.ObjectOperations.GetObjectVersionAndProperties(InvoiceObjVer);
		if (!InvoiceoObjProperties.VersionData.ObjectCheckedOut) {
			var COInvoiceObjVer = Vault.ObjectOperations.CheckOut(objID);

			var InvoiceVerified = new MFiles.PropertyValue();
			InvoiceVerified.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.Freight");
			InvoiceVerified.TypedValue.SetValue(MFDatatypeFloating, FreightCost);
			Vault.ObjectPropertyOperations.SetProperty(COInvoiceObjVer.ObjVer, InvoiceVerified);

			var InvoiceFreight = new MFiles.PropertyValue();
			InvoiceFreight.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.FreightTaxCode");
			InvoiceFreight.TypedValue.SetValue(MFDatatypeText, FreightTaxCode);
			Vault.ObjectPropertyOperations.SetProperty(COInvoiceObjVer.ObjVer, InvoiceFreight);

			Vault.ObjectOperations.CheckIn(COInvoiceObjVer.ObjVer);
		}
		return true;
	}

	this.GetGLAccount = function () {

		var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			gUtil.FindObjectsWithoutValue('vObject.GLAccount'), MFSearchFlagNone, true);
		var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers();
		var dropValue;
		var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
		this.GLAccountList = "<option value=' '></option>";
		this.GLAccountArr[0] = "";
		for (var i = 1; i < ObjectSearchResults.Count; i++) {
			var props = ObjectSearchResultsProperties[i];
			dropValue = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccountName", true).Value.DisplayValue;
			var val = dropValue.split("-");
			this.GLAccountList += '<option value=\"' + dropValue + '\">' + dropValue + '</option>';
			this.GLAccountArr[i] = dropValue;
		}
	}

	this.CheckNull = function () {
		var tbl = document.getElementById('invoice_details_table');
		document.getElementById('invoice_details_table').rows.length
		for (var i = 1; i < tbl.rows.length - 1; i++) {
			for (var j = 1; j < 4; j++) {
				var val = tbl.rows[i].cells[j].querySelector('input').value;
				if (val === "" || val === 0 || val === "$") return false;
			}
		}

		return true;
	};

	this.removeRow = function (sender) {
		$(sender).parent().parent().remove();
		this.CalculateTotal();
		this.toggleButton(false);
	};

	this.addRowToTable = function (tableID) {
		var tbl = document.getElementById(tableID);
		var lastRow = tbl.rows.length;
		var row = tbl.insertRow(lastRow - 1);
		var iteration = lastRow - 2;

		var cellLeft = row.insertCell(0);
		var el = document.createElement('IMG');
		el.setAttribute('src', 'DILibrary/images/remove-button-red.png');
		el.setAttribute('id', 'chk');
		el.setAttribute('onclick', 'gUtil.removeRow(this)');

		cellLeft.appendChild(el);
		cellLeft.style.padding = '0 0 0 0px';
		cellLeft.style.textAlign = 'center';

		//var startCell = (iteration == 0)? 1 : (iteration / iteration);
		var startCell = 1;

		for (var i = iteration; i < iteration + 8; i++) {
			var id = "";
			if (startCell == 1) id = "ItemNumber";
			else if (startCell == 2) id = "Quantity";
			else if (startCell == 3) id = "UnitPrice";
			else if (startCell == 4) id = "InvoiceLineExtension";
			else if (startCell == 5) id = "TaxCode";
			else if (startCell == 6) id = "Tax";
			else if (startCell == 7) id = "PONumber";
			else if (startCell == 8) id = "GLAccount";

			var cellRight = row.insertCell(startCell);

			if (startCell != 8) {
				var el = document.createElement('input');

				el.setAttribute('type', 'text');
				el.setAttribute('id', id + iteration);
				el.classList.add("inputData");

				if (startCell == 1) {
					el.setAttribute('onclick', 'openForm(' + iteration + ')');
					var hiddenItem = document.createElement('hidden');
					hiddenItem.setAttribute('id', 'ItemDescription' + iteration);
					el.appendChild(hiddenItem);
				}

				if (startCell == 2 || startCell == 3) {
					el.setAttribute('onkeyup', 'gUtil.Calculate(\'' + iteration + '\')');
					el.setAttribute('onkeypress', 'return gUtil.isNumberKey(event,this.id)');
				}
				if (startCell == 4 || startCell == 6) {
					el.setAttribute("readonly", 'true');
					el.classList.remove("inputData");
				}

				if (startCell == 5) {
					el.setAttribute('onblur', 'gUtil.CheckTaxCode(\'' + iteration + '\')');
				}
				if (startCell == 7) {
					el.setAttribute('onkeypress', 'return gUtil.isNumberKey(event,this.id)');
				}
				cellRight.appendChild(el);
			}
			else {
				var glSel = document.createElement('select');
				glSel.setAttribute('id', 'GLAccount' + iteration);
				glSel.className = "SelectGL";

				for (i = 0; i < this.GLAccountArr.length; i++) {
					var glOpt = document.createElement('option');
					glOpt.value = glOpt.text = this.GLAccountArr[i];
					glSel.appendChild(glOpt);
				}
				cellRight.appendChild(glSel);
				$("#GLAccount" + iteration).select2({ allowClear: true, placeholder: { text: '' } });
				$("#GLAccount" + iteration).val(null).trigger("change");
				$('.SelectGL').on('select2:open', function (e) {
					var tabW = $('#invoice_details_table')[0].clientWidth;
					var pos = $(this).select('select2-container').position().left;
					$('.select2-dropdown').css('left', (tabW - 255 - pos) + 'px');
				});
			}
			startCell++;
		}
		this.toggleButton(false);
	};

	this.Calculate = function (idx) {
		var Qty = ($("#Quantity" + idx)[0] == undefined) ? "" : $("#Quantity" + idx)[0].value;
		var Unit = $("#UnitPrice" + idx)[0].value;

		Unit = (Unit.substring(0, 1) == "$") ? Unit.substring(1) : Unit;
		var Total = this.GetTax(Qty, Unit, TaxCode);

		$("#InvoiceLineExtension" + idx)[0].value = (this.CurrencyFormatter(Total[0]) == "NaN") ? this.CurrencyFormatter("0") : this.CurrencyFormatter(Total[0]);
		$("#Tax" + idx)[0].value = (this.CurrencyFormatter(Total[1]) == "NaN") ? this.CurrencyFormatter("0") : this.CurrencyFormatter(Total[1]);
		$("#TaxCode" + idx)[0].value = TaxCode;
		if (Unit.substring(0, 1) != "$") $("#UnitPrice" + idx)[0].value = '$' + Unit;

		this.CalculateTotal();
	};

	this.CalculateFreight = function () {
		var Qty = 1;
		var Cost = $("#FreightCost")[0].value;
		var TC = $("#FreightTaxCode")[0].value;

		Cost = (Cost.substring(0, 1) == "$") ? Cost.substring(1) : Cost;
		var Total = this.GetTax(Qty, Cost, TC);
		$("#FreightTax").text((this.CurrencyFormatter(Total[1]) == "NaN") ? this.CurrencyFormatter("0") : this.CurrencyFormatter(Total[1]));

		this.SetTotalCost();
	};

	this.CalculateTotal = function () {

		var lastRow = $("#invoice_details_table")[0].rows.length - 2;	// header
		var Ext = 0, Tax = 0;
		for (var i = 0; i < lastRow; i++) {
			if ($("#InvoiceLineExtension" + i)[0] != undefined) {
				var currency = $("#InvoiceLineExtension" + i)[0].value;
				Ext += this.GetNumber(currency);
			}
			if ($("#Tax" + i)[0] != undefined) {
				var currency = $("#Tax" + i)[0].value;
				Tax += this.GetNumber(currency);
			}
		}
		$("#TotalExt").text(this.CurrencyFormatter(Ext));
		$("#TotalTax")[0].value = this.CurrencyFormatter(Tax);
		this.setBalanceStyle();
		this.SetTotalCost();

	};

	this.SetTotalCostXXX = function () {

		var ci = (controller.Invoice == undefined) ? controller.editor : controller.Invoice;
		var DetailSubtotal = this.GetNumber($("#TotalExt").text()) + this.GetNumber($("#FreightCost")[0].value);
		var InvoiceSubTotal = this.GetNumber(ci.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.Subtotal", true).Value.DisplayValue);
		var DetailTax = this.GetNumber($("#TotalTax")[0].value) + this.GetNumber($("#FreightTax").text());
		var InvoiceTax = this.GetNumber(ci.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.Tax", true).Value.DisplayValue);
		//var DetailTotal = (DetailSubtotal + DetailTax + this.GetNumber($("#FreightCost")[0].value) + this.GetNumber($("#FreightTax").text())).toFixed(2);
		var DetailTotal = (DetailSubtotal + DetailTax).toFixed(2);
		var InvoiceTotal = (parseFloat(InvoiceSubTotal) + parseFloat(InvoiceTax)).toFixed(2);// + this.GetNumber($("#FreightCost")[0].value) + this.GetNumber($("#FreightTax").text());


		var BalanceBG = "rgb(223, 248, 223)";
		var NotBalanceBG = "rgb(250, 215, 215)";
		var bgSubtotal = (DetailSubtotal == InvoiceSubTotal) ? BalanceBG : NotBalanceBG;
		var bgTax = (DetailTax == InvoiceTax) ? BalanceBG : NotBalanceBG;
		var bgTotal = (DetailTotal == InvoiceTotal) ? BalanceBG : NotBalanceBG;

		$("#DetailSubtotal").text(this.CurrencyFormatter(DetailSubtotal));
		$("#InvoiceSubtotal").text(this.CurrencyFormatter(InvoiceSubTotal));
		$("#hSubtotal").text(this.CurrencyFormatter(InvoiceSubTotal));
		$("#DetailTax").text(this.CurrencyFormatter(DetailTax));
		$("#InvoiceTax").text(this.CurrencyFormatter(InvoiceTax));
		$("#DetailTotal").text(this.CurrencyFormatter(DetailTotal));
		$("#InvoiceTotal").text(this.CurrencyFormatter(InvoiceTotal));

		$("#DetailSubtotal").css("background-color", bgSubtotal);
		$("#DetailTax").css("background-color", bgTax);
		$("#DetailTotal").css("background-color", bgTotal);
	}

	this.SetTotalCost = function () {

		var ci = (controller.Invoice == undefined) ? controller.editor : controller.Invoice;
		var DetailSubtotal = this.GetNumber($("#TotalExt").text()) + this.GetNumber($("#FreightCost")[0].value);
		var InvoiceSubTotal = this.GetNumber(ci.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.Subtotal", true).Value.DisplayValue);
		var DetailTax = this.GetNumber($("#TotalTax")[0].value) + this.GetNumber($("#FreightTax").text());
		var InvoiceTax = this.GetNumber(ci.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.Tax", true).Value.DisplayValue);
		var DetailTotal = (DetailSubtotal + DetailTax);//.toFixed(2);
		var InvoiceTotal = (parseFloat(InvoiceSubTotal) + parseFloat(InvoiceTax)).toFixed(2);// + this.GetNumber($("#FreightCost")[0].value) + this.GetNumber($("#FreightTax").text());

		var BalanceBG = "rgb(223, 248, 223)";
		var NotBalanceBG = "rgb(250, 215, 215)";
		var bgSubtotal = (DetailSubtotal == InvoiceSubTotal) ? BalanceBG : NotBalanceBG;
		var bgTax = (DetailTax == InvoiceTax) ? BalanceBG : NotBalanceBG;
		var bgTotal = (DetailTotal == InvoiceTotal) ? BalanceBG : NotBalanceBG;

		$("#DetailSubtotal").text(this.CurrencyFormatter(DetailSubtotal));
		$("#InvoiceSubtotal").text(this.CurrencyFormatter(InvoiceSubTotal));
		$("#hSubtotal").text(this.CurrencyFormatter(InvoiceSubTotal));
		$("#DetailTax").text(this.CurrencyFormatter(DetailTax));
		$("#InvoiceTax").text(this.CurrencyFormatter(InvoiceTax));
		$("#DetailTotal").text(this.CurrencyFormatter(DetailTotal));
		$("#InvoiceTotal").text(this.CurrencyFormatter(InvoiceTotal));

		$("#DetailSubtotal").css("background-color", bgSubtotal);
		$("#DetailTax").css("background-color", bgTax);
		$("#DetailTotal").css("background-color", bgTotal);
	}

	this.isNumberKey = function (evt, id) {
		try {
			var charCode = (evt.which) ? evt.which : event.keyCode;

			if (charCode == 46) {	// del key
				var txt = document.getElementById(id).value;
				if (!(txt.indexOf(".") > -1)) {

					return true;
				}
			}
			if (charCode > 31 && (charCode < 48 || charCode > 57))
				return false;

			return true;
		} catch (w) {
			alert(w);
		}
	};

	this.isNumberKeyWithCurrency = function (evt, id) {
		var val = $("#" + id)[0].value;
		if (val.substring(0, 1) == "$") val = val.substring(1);
		try {
			var charCode = (evt.which) ? evt.which : event.keyCode;

			if (charCode == 46) {	// del key
				if (!(val.indexOf(".") > -1)) {
					return true;
				}
			}
			if (charCode > 31 && (charCode < 48 || charCode > 57)) return false;

			$("#" + id)[0].value = "$" + val;

			return true;
		} catch (w) {
			alert(w);
		}
	};

	this.setBalanceStyle = function () {
		var subTotal = this.GetNumber(document.getElementById('hSubtotal').value);
		var total = this.GetNumber($("#TotalExt").text());
		//var total = document.getElementById('Total').value.replace(/[^0-9.-]+/g, "");

		var TextLabel = document.getElementById('Balanced');

		if (subTotal != total) {
			TextLabel.innerHTML = "Not Balanced";
			TextLabel.style.color = "red";
			TextLabel.style.background = "rgb(250, 215, 215)";
		}
		else {
			TextLabel.innerHTML = "Balanced";
			TextLabel.style.color = "green";
			TextLabel.style.background = "rgb(223, 248, 223)";
		}
	};

	this.SortLineNo = function (ArrayVal) {
		ArrayVal.sort(function (a, b) {
			return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
		});
		return ArrayVal;
	};

	this.isRequired = function (assocPropDefs, propertyNumber) {
		for (var i = 0; i < assocPropDefs.Count; i++) {
			if (assocPropDefs[i].PropertyDef == propertyNumber)
				return assocPropDefs[i].Required;
		}
		return false;
	};

	this.ResizeContentArea = function () {

		// Figure out all heights.
		win = $(window).outerHeight(),
			footer = $("#mf-footer").outerHeight(),
			content = win - footer;
		$(".panel-container").height(content - $("#titleLabel").height());

		// Set height of the content area.
		var pch = $(".panel-container").height();
		var tabh = $(".ui-tabs-nav").height();
		$(".mf-layout-vertical").height(win);
		$(".ui-tabs-panel").height(pch - tabh);
		$("mf-section, .mf-section-properties").height($(".panel-left").height() - 30);
		$(".ui-scrollable").css('height', $(".panel-left").height() - 30);
	};

	this.FindObjectsWithoutValue = function (OTAlias) {

		var OT = Vault.ObjectTypeOperations.GetObjectTypeIDByAlias(OTAlias);

		var oSC = new MFiles.SearchCondition();
		var oSCs = new MFiles.SearchConditions();

		// Search condition that defines the object is not marked as deleted.
		oSC.ConditionType = MFConditionTypeEqual;
		oSC.Expression.SetStatusValueExpression(MFStatusTypeDeleted, new MFiles.DataFunctionCall());
		oSC.TypedValue.SetValue(MFDatatypeBoolean, false);
		oSCs.Add(-1, oSC);

		// Search condition that defines the object type 
		oSC.ConditionType = MFConditionTypeEqual;
		oSC.Expression.SetStatusValueExpression(MFStatusTypeObjectTypeID, new MFiles.DataFunctionCall());
		oSC.TypedValue.SetValue(MFDatatypeLookup, OT);
		oSCs.Add(-1, oSC);

		return oSCs;
	};

	this.StoreItemNDesc = function (line) {
		var item = $("#item")[0].value;
		var itemDesc = $("#itemDescription")[0].value;

		if (item == "") {
			alert("Item is required!");
			return;
		}

		$("#ItemNumber" + line)[0].value = item;
		$("#ItemNumber" + line)[0].title = itemDesc;
		$("#ItemDescription" + line)[0].value = itemDesc;
		closeForm();
	}

	this.GetPOTaxCode = function (PONO) {
		if (PONO == "") return null;
		var POObjSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault, 'vObject.PurchaseOrderDetail', 'vProperty.PurchaseOrder', MFDatatypeText, PONO), MFSearchFlagNone, true);

		var POObjVers = POObjSearchResults.GetAsObjectVersions().GetAsObjVers();
		var POResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(POObjVers);

		if (POResultsProperties.Count > 0) {
			return this.GetTaxDefbyID(POResultsProperties[0].SearchForPropertyByAlias(Vault, "vProperty.TaxCode", true).TypedValue.Value)
				.SearchForPropertyByAlias(Vault, "vProperty.TaxCode", true).TypedValue.Value;
		}
	}

	this.GetTaxDef = function () {

		var TaxSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			this.FindObjectsWithoutValue('vObject.TaxDefinition'), MFSearchFlagNone, true);
		var TAXObjVers = TaxSearchResults.GetAsObjectVersions().GetAsObjVers();
		var TAXResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(TAXObjVers);

		for (var i = 0; i < TaxSearchResults.Count; i++) {
			var taxInfo = [];
			var props = TAXResultsProperties[i];
			taxInfo[0] = props.SearchForPropertyByAlias(Vault, "vProperty.TaxCode", true).TypedValue.Value;
			taxInfo[1] = props.SearchForPropertyByAlias(Vault, "vProperty.TaxDescription", true).TypedValue.Value;
			this.TaxInfoArr[i] = taxInfo;
			this.TaxCodeArr[i] = taxInfo[0];
		}
	}

	this.GetTaxDefbyID = function (TaxID) {

		var TaxSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			this.FindObjectsWithoutValue('vObject.TaxDefinition'), MFSearchFlagNone, true);
		for (var i = 0; i < TaxSearchResults.Count; i++) {
			if (TaxSearchResults[i].DisplayID == TaxID) {
				var objID = new MFiles.ObjID();
				objID.SetIDs(TaxSearchResults[i].ObjVer.Type, TaxSearchResults[i].ObjVer.ID);
				var TaxObjVer = Vault.ObjectOperations.GetLatestObjVer(objID, false, true);
				return Vault.ObjectPropertyOperations.GetProperties(TaxObjVer);
			}
		}
	}

	this.GetTaxDefbyCode = function (TaxCode) {

		var TaxSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault, 'vObject.TaxDefinition', 'vProperty.TaxCode', MFDatatypeText, TaxCode), MFSearchFlagNone, true);
		var TaxObjVers = TaxSearchResults.GetAsObjectVersions().GetAsObjVers();
		var TaxProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(TaxObjVers);
		return TaxProperties[0];
	}

	this.GetTax = function (Qty, Price, TaxCode) {

		var TaxDef = this.GetTaxDefbyCode(TaxCode);
		var AdjTax = [];

		if (TaxDef == null) {
			AdjTax[0] = parseInt(Qty) * parseFloat(Price);
			AdjTax[1] = 0;
			AdjTax[2] = "";
			AdjTax[3] = "";
			return AdjTax;
		}

		//Calculation rules for Including Tax

		//Ext = AdjExt + Tax
		//AdjExt = Ext / (1 + TaxRate)
		//for example, 100 is Ext, 
		//AdjExt = 100 / 1.13 = 88.5(88.4955..)
		//Tax = AdjExt * TaxRate = 88.5 * 0.13 = 11.5

		var OriExt = parseInt(Qty) * parseFloat(Price);
		var AdjustExt = OriExt;

		var TaxCode = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.TaxCode", true).TypedValue.Value;
		TaxCode = (TaxCode == null) ? "" : TaxCode;
		var TaxDesc = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.TaxDescription", true).TypedValue.Value;
		TaxDesc = (TaxDesc == null) ? "" : TaxDesc;
		var GSTR = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.GSTRate", true).TypedValue.Value;
		var GSTP = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.GSTInPrice", true).TypedValue.Value;
		var PSTR = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.PSTRate", true).TypedValue.Value;
		var PSTP = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.PSTInPrice", true).TypedValue.Value;
		var HSTR = TaxDef.SearchForPropertyByAlias(Vault, "vPropert.HSTRate", true).TypedValue.Value;
		var HSTP = TaxDef.SearchForPropertyByAlias(Vault, "vProperty.HSTInPrice", true).TypedValue.Value;
		var TotalTax = 0;

		//HSTP = true;  // for test
		if (GSTR != 0) {
			if (GSTP) {		// included tax
				TotalTax += OriExt - OriExt / (1 + GSTR / 100);	// calculate only for Tax
				AdjustExt -= TotalTax;
			}
			else TotalTax += OriExt * (GSTR / 100);
		}

		if (PSTR != 0) {
			if (PSTP) {		// included tax
				TotalTax += OriExt - OriExt / (1 + PSTR / 100);
				AdjustExt -= TotalTax;
			}
			else TotalTax += OriExt * (PSTR / 100);
		}

		if (HSTR != 0) {
			if (HSTP) {		// included tax
				//TotalTax += (OriExt / (1 + HSTR / 100)) * (HSTR / 100);
				TotalTax += OriExt - OriExt / (1 + HSTR / 100);
				AdjustExt -= TotalTax;
			}
			else TotalTax += OriExt * (HSTR / 100);
		}

		AdjTax[0] = AdjustExt;
		AdjTax[1] = TotalTax;
		AdjTax[2] = TaxCode;
		AdjTax[3] = TaxDesc;

		return AdjTax;
	}

	this.CheckTaxCode = function (_idx) {
		if (_idx == "FreightCost") {
			$("#FreightCost")[0].value = this.CurrencyFormatter(this.GetNumber($("#FreightCost")[0].value));
			return;
		}

		var tx = $("#" + _idx)[0].value.toUpperCase();
		if (tx == "") tx = null;
		if (this.TaxCodeArr.indexOf(tx) > 0) {
			TaxCode = tx;
			if (_idx == "FreightTaxCode") {
				$("#FreightTaxCode")[0].value = $("#FreightTaxCode")[0].value.toUpperCase();
				this.CalculateFreight();
			}
			else this.Calculate(this.GetNumber(_idx));
		}
		else {
			if ($("#popupTaxInfo")[0].innerHTML == "") {
				alert("Tax code is invalid!!\nYou can see the Tax Code hover your mouse over the blue icon.");
			}
			$("#" + _idx)[0].focus();
		}
	}

	this.CurrencyFormatter = function (number) {
		var formatter = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'CAD',
			minimumFractionDigits: 2,
		});

		return formatter.format(number);
	}

	this.GetNumber = function (str) {
		if ($.isNumeric(str)) return str;
		var n = parseFloat(str.replace(/[^0-9.-]+/g, ""));
		return (isNaN(n)) ? 0 : n;
	}
}



function APUtil(Vault, controller, editor) {

	this.Vault = Vault;
	this.controller = controller;
	this.editor = editor;
	this.GLAccountList = "";
	this.GLAccountArr = [];

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
		else if (pptName == "Tax") return 5;
		else if (pptName == "PONumber") return 6;
		else if (pptName == "GLAccount") return 7;
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
		}
		return true;
	}

	this.UpdateInvoice = function () {
		var ci = controller.Invoice;
		var Verified = ($("#Verified")[0].checked) ? 1 : 0;
		var Freight = ($("#txtFreight")[0].value.substring(0, 1) == "$") ? $("#txtFreight")[0].value.substring(1) : $("#txtFreight")[0].value.substring(0);
		var Taxable = ($("#chkTaxable")[0].checked) ? 1 : 0;

		var objID = new MFiles.ObjID();
		objID.SetIDs(ci.ObjectVersion.ObjVer.Type, ci.ObjectVersion.ObjVer.ID);
		var InvoiceObjVer = Vault.ObjectOperations.GetLatestObjVer(objID, false, true);
		var InvoiceoObjProperties = Vault.ObjectOperations.GetObjectVersionAndProperties(InvoiceObjVer);
		/*if (!InvoiceoObjProperties.VersionData.ObjectCheckedOut) {
			var COInvoiceObjVer = Vault.ObjectOperations.CheckOut(objID);

			var InvoiceVerified = new MFiles.PropertyValue();
			InvoiceVerified.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.Verified");
			InvoiceVerified.TypedValue.SetValue(MFDatatypeBoolean, Verified);
			Vault.ObjectPropertyOperations.SetProperty(COInvoiceObjVer.ObjVer, InvoiceVerified);

			//var InvoiceFreight = new MFiles.PropertyValue();
			//InvoiceFreight.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.Freight");
			//InvoiceFreight.TypedValue.SetValue(MFDatatypeFloating, Freight);
			//Vault.ObjectPropertyOperations.SetProperty(COInvoiceObjVer.ObjVer, InvoiceFreight);


			//var InvoiceTaxable = new MFiles.PropertyValue();
			//InvoiceTaxable.PropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.Taxable");
			//InvoiceTaxable.TypedValue.SetValue(MFDatatypeBoolean, Taxable);
			//Vault.ObjectPropertyOperations.SetProperty(COInvoiceObjVer.ObjVer, InvoiceTaxable);

			Vault.ObjectOperations.CheckIn(COInvoiceObjVer.ObjVer);
		}*/
		return true;
	}

	this.setGL = function (dropValue) {
		var val = dropValue.split("-");
		$('#GLAccount' + gNo).val(val[0].trim());
		document.getElementById("GLOption").style.display = "none";
	}

	this.GetGLAccount = function () {

		var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			gUtil.FindGLObjects('vObject.GLAccount'), MFSearchFlagNone, true);
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

		for (var i = iteration; i < iteration + 7; i++) {
			var id = "";
			if (startCell == 1) id = "ItemNumber";
			else if (startCell == 2) id = "Quantity";
			else if (startCell == 3) id = "UnitPrice";
			else if (startCell == 4) id = "InvoiceLineExtension";
			else if (startCell == 5) id = "Tax";
			else if (startCell == 6) id = "PONumber";
			else if (startCell == 7) id = "GLAccount";

			var cellRight = row.insertCell(startCell);

			if (startCell != 7) {
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
					el.setAttribute('onkeyup', 'gUtil.Calculate(\'Quantity' + iteration + '\', \'UnitPrice' + iteration + '\', \'InvoiceLineExtension' + iteration + '\')');
					el.setAttribute('onkeypress', 'return gUtil.isNumberKey(event,this.id)');
				}
				if (startCell == 4) {
					el.setAttribute("readonly", 'true');
					el.classList.remove("inputData");
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
			}
			startCell++;
		}
		this.toggleButton(false);
	};

	this.Calculate = function (_qty, _unit, _ext) {
		var Ext = document.getElementById(_ext);
		var Qty = document.getElementById(_qty).value;


		var Unit = document.getElementById(_unit).value;
		if (Unit.substring(0, 1) != "$") document.getElementById(_unit).value = '$' + Unit;

		var Total = (Unit.substring(0, 1) == "$") ? Qty * Unit.substr(1) * 1 : Qty * Unit * 1;
		Ext.value = '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 });

		this.CalculateTotal();
	};

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

	this.CalculateTotal = function () {

		var tbl = document.getElementById('invoice_details_table');
		var lastRow = tbl.rows.length - 1;	// header
		var Ext = 0;
		for (var i = 0; i <= lastRow; i++) {
			if (document.getElementById('InvoiceLineExtension' + i) != undefined) {
				var currency = document.getElementById('InvoiceLineExtension' + i).value;

				Ext += Number(currency.replace(/[^0-9.-]+/g, ""));
			}
		}
		document.getElementById('Total').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
		this.setBalanceStyle();
	};

	this.setBalanceStyle = function () {
		var subTotal = document.getElementById('hSubtotal').value.replace(/[^0-9.-]+/g, "");
		var total = document.getElementById('Total').value.replace(/[^0-9.-]+/g, "");

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

	this.FindGLObjects = function (OTAlias) {

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

}

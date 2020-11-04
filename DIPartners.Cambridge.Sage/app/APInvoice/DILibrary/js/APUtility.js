
(function ($, undefined) {
	$.widget("mfiles.metadatacard", {
		initialize: function (ap) {
			var self = ap.apUtil;
			var saveLabel = ap.apUtil.GetText("IDS_METADATACARD_COMMAND_SAVE");
			var saveTooltip = ap.apUtil.GetText("IDS_METADATACARD_BUTTON_TOOLTIP_SAVE");
			var discardLabel = ap.apUtil.GetText("IDS_METADATACARD_BUTTON_DISCARD");

			$("#save-data").button({ label: saveLabel });
			$("#save-data").attr("title", saveTooltip);
			$("#discard-data").button({ label: discardLabel });

			$("#save-data").mouseenter(function () {
				$(this).css("background", "#7ecaf0");
			}).mouseleave(function () { $(this).css("background", "#318CCC"); });
			$("#discard-data").mouseenter(function () {
				$(this).css("background", "#7ecaf0");
			}).mouseleave(function () { $(this).css("background", "#318CCC"); });

			$(".inputData").click(function (event) {
				// Discard metadata.
				self.toggleButton(false);

				// Stop event propagation.
				event.stopPropagation();
			});

			$(window).resize(function () {
				self.ResizeContentArea();
			});

			self.toggleButton(true);
		},
	});
})(jQuery);


function APUtil(Vault, controller, editor) {

	this.Vault = Vault;
	this.controller = controller;
	this.editor = editor;

	this.toggleButton = function (val) {
		$("#save-data, #discard-data").toggleClass("ui-state-hidden", val);
	};

	this.GetColIndex = function (pptName) {

		if (pptName == "ItemNumber") return 1;
		else if (pptName == "Quantity") return 2;
		else if (pptName == "UnitPrice") return 3;
		else if (pptName == "InvoiceLineExtension") return 4;
		else if (pptName == "PONumber") return 5;
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

	this.CreateNewDetails = function () {
		var ci = controller.Invoice;
		if (this.DuplicatedPOValue()) return false;
		var actCount = document.getElementById('invoice_details_table').rows.length - 2;

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
			propertyValues.Add(-1, this.GetPropertyValue("Quantity", i));             //1151
			propertyValues.Add(-1, this.GetPropertyValue("UnitPrice", i));            //1154
			propertyValues.Add(-1, this.GetPropertyValue("InvoiceLineExtension", i)); //1157

			// set PO Details
			var POValues = this.GetPOPropertyValue(i);
			if (POValues == -1) return false;
			if (POValues != null) propertyValues.Add(-1, POValues);      //PO Details

			var oObjectVersionAndProperties = Vault.ObjectOperations.CreateNewObject(
				Vault.ObjectTypeOperations.GetObjectTypeIDByAlias("vObject.InvoiceDetail"),
				propertyValues,
				MFiles.CreateInstance("SourceObjectFiles"),
				MFiles.CreateInstance("AccessControlList"));

			Vault.ObjectOperations.CheckIn(oObjectVersionAndProperties.ObjVer);
		}
		return true;
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

		//iteration = (lastRow == 2) ? 1 : Number(tbl.rows[lastRow - 2].cells[4].firstChild.id.replace(/[^0-9.-]+/g, "")) + 1;

		var cellLeft = row.insertCell(0);
		var el = document.createElement('IMG');
		el.setAttribute('src', 'DILibrary/images/remove-button-red.png');
		el.setAttribute('style', 'padding-left:0px;text-align:center;');
		el.setAttribute('id', 'chk');
		el.setAttribute('onclick', 'gUtil.removeRow(this)');

		cellLeft.appendChild(el);
		cellLeft.style.padding = '0 0 0 0px';
		cellLeft.style.textAlign = 'center';

		var startCell = iteration / iteration;

		for (var i = iteration; i < iteration + 5; i++) {
			var id = "";
			var cellRight = row.insertCell(startCell);
			var el = document.createElement('input');

			if (startCell == 1) id = "ItemNumber";
			else if (startCell == 2) id = "Quantity";
			else if (startCell == 3) id = "UnitPrice";
			else if (startCell == 4) id = "Extension";
			else if (startCell == 5) id = "PONumber";

			el.setAttribute('type', 'text');
			el.setAttribute('id', id + iteration);
			el.classList.add("inputData");

			if (startCell == 2 || startCell == 3) {
				el.setAttribute('onkeyup', 'gUtil.Calculate(\'Quantity' + iteration + '\', \'UnitPrice' + iteration + '\', \'Extension' + iteration + '\')');
				el.setAttribute('onkeypress', 'return gUtil.isNumberKey(event,this.id)');
			}
			if (startCell == 4) {
				el.setAttribute("readonly", 'true');
				el.classList.remove("inputData");
			}

			cellRight.appendChild(el);
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

	this.CalculateTotal = function () {

		var tbl = document.getElementById('invoice_details_table');
		var lastRow = tbl.rows.length - 1;	// header
		var Ext = 0;
		for (var i = 0; i <= lastRow; i++) {
			if (document.getElementById('Extension' + i) != undefined) {
				var currency = document.getElementById('Extension' + i).value;

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
			TextLabel.style.width = "85px";
		}
		else {
			TextLabel.innerHTML = "Balanced";
			TextLabel.style.color = "green";
			TextLabel.style.background = "rgb(223, 248, 223)";
			TextLabel.style.width = "60px";
		}

		TextLabel.style.height = "22px";
		TextLabel.style.textAlign = "center";
		TextLabel.style.verticalAlign = "sub";
		TextLabel.style.display = "inline-block";
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
		$(".mf-section-properties").outerHeight($(".ui-tabs-panel").height());
	};

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

}

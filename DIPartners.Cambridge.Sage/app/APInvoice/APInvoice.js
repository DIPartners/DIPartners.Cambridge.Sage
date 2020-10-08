//const { error } = require("jquery");
var gDashboard;
var isPopup;
// Entry point of the dashboard.
function OnNewDashboard(dashboard) {

    gDashboard = dashboard;
    isPopup = dashboard.IsPopupDashboard;

    // Parent is a shell pane container (tab), when dashboard is shown in right pane.
    var tab = dashboard.Parent;

    // Initialize console.
    if (!isPopup) {
        console.initialize(tab.ShellFrame.ShellUI, "APInvoice");
    }
    else {
        $("#iv-buttons").empty();
    }

    // Some things are ready only after the dashboard has started.
    dashboard.Events.Register(MFiles.Event.Started, OnStarted);
    function OnStarted() {
        SetDetails(dashboard);
    }
}

function SetDetails(dashboard) {
    var Vault = dashboard.Vault;
    var controller = dashboard.CustomData;
    controller.Vault = Vault;
    var editor = controller.Invoice;


    //console.log(controller.ObjectVersion);
    // Apply vertical layout.
    $("body").addClass("mf-layout-vertical");
    // Show some information of the document.
    $('#message_placeholder').text(controller.ObjectVersion.Title + ' (' + controller.ObjectVersion.ObjVer.ID + ')');


    var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(controller.ObjectVersion.ObjVer);

    controller.Invoice = {
        ObjectVersion: controller.ObjectVersion,
        ObjectVersionProperties: ObjectVersionProperties,
        Events: dashboard.Events
    };

    var PONO = ObjectVersionProperties.SearchForPropertyByAlias(dashboard.Vault, "vProperty.POReference", true).Value.DisplayValue;
    if (PONO != "") {
        var ObjectSearchResults = dashboard.Vault.ObjectSearchOperations.SearchForObjectsByConditions(
            FindObjects(dashboard.Vault, 'vOjbect.PurchaseOrder', 'vProperty.PONumber', MFDatatypeText, PONO), MFSearchFlagNone, true);
        if (ObjectSearchResults.Count == 1) {
            var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(ObjectSearchResults[0].ObjVer);
            /*
                        var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
                        var ObjectSearchResultsProperties = dashboard.Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
            */
            controller.PurchaseOrder = {
                ObjectVersion: ObjectSearchResults[0],
                ObjectVersionProperties: ObjectVersionProperties,
                PropertyControls: PropertyControls,
                Events: dashboard.Events
            };
            var editor = controller.PurchaseOrder;
            var PropertyControls = new Array();
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PONumber'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.Vendor'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PODate'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PORequiredDate'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.Currency'));
            editor.PropertyControls = PropertyControls;

            var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
                FindObjects(Vault, 'vObject.PurchaseOrderDetail', 'vProperty.PurchaseOrder', MFDatatypeText, editor.ObjectVersion.Title), MFSearchFlagNone, true);
        }
    }
    controller.PackingSlip = {
        ObjectVersion: null,
        ObjectVersionProperties: null,
        PropertyControls: null,
        Events: dashboard.Events
    };


    SetInvoiceDetails(controller);
    $("#tabs").tabs("option", "active", 0);
    SetPODetails(controller);
    SetPSDetails(controller);
    if (!isPopup) CreatePopupIcon();
    else {
        $("input").prop("disabled", true);
        $('img').hide();
        $("#addRow").empty();
    }
}

function GetColIndex(pptName) {

    if (pptName == "ItemNumber") return 1;
    else if (pptName == "Quantity") return 2;
    else if (pptName == "UnitPrice") return 3;
    else if (pptName == "InvoiceLineExtension") return 4;
}

function GetPropertyValue(vault, pptName, no) {

    var tbl = document.getElementById('invoice_details_table');
    var propertyValue = new MFiles.PropertyValue();
    var VaultOp = vault.PropertyDefOperations;

    var value = tbl.rows[no + 1].cells[GetColIndex(pptName)].querySelector('input').value;

    propertyValue.PropertyDef = VaultOp.GetPropertyDefIDByAlias("vProperty." + pptName);
    propertyValue.Value.SetValue(VaultOp.GetPropertyDef(propertyValue.PropertyDef).DataType, value);

    return propertyValue;
}

function DestroyOldDetails(editor, Vault) {

    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
        FindObjects(Vault, 'vObject.InvoiceDetail', 'vProperty.Invoice', MFDatatypeLookup, editor.ObjectVersion.ObjVer.ID), MFSearchFlagNone, true);

    for (var k = 0; k < ObjectSearchResults.count; k++) {
        var objID = new MFiles.ObjID();
        objID.SetIDs(ObjectSearchResults[k].ObjVer.Type, ObjectSearchResults[k].ObjVer.ID);
        Vault.ObjectOperations.DestroyObject(objID, true, -1);
    }
}

function CreateNewDetails(editor, Vault) {
    var actCount = document.getElementById('invoice_details_table').rows.length - 2;

    for (var i = 0; i < actCount; i++) {
        var propertyValues = new MFiles.PropertyValues();

        //set class
        var classID = editor.ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
        var propertyValue = new MFiles.PropertyValue();
        propertyValue.PropertyDef = MFBuiltInPropertyDefClass;
        propertyValue.Value.SetValue(MFDatatypeLookup, classID);
        propertyValues.Add(-1, propertyValue);

        // set Name or Title
        var propTitle = editor.ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefNameOrTitle);
        var propertyValue = new MFiles.PropertyValue();
        propertyValue.PropertyDef = MFBuiltInPropertyDefNameOrTitle;
        propertyValue.Value.SetValue(propTitle.TypedValue.DataType, propTitle.TypedValue.DisplayValue);
        propertyValues.Add(-1, propertyValue);

        // set Invoice - lookup
        var newInvoice = new MFiles.Lookup();
        newInvoice.ObjectType = MFBuiltInObjectTypeDocument;
        newInvoice.Item = editor.ObjectVersion.ObjVer.ID;
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

        propertyValues.Add(-1, GetPropertyValue(Vault, "ItemNumber", i));            //1150
        propertyValues.Add(-1, GetPropertyValue(Vault, "Quantity", i));             //1151
        propertyValues.Add(-1, GetPropertyValue(Vault, "UnitPrice", i));            //1154
        propertyValues.Add(-1, GetPropertyValue(Vault, "InvoiceLineExtension", i)); //1157

        var oObjectVersionAndProperties = Vault.ObjectOperations.CreateNewObject(
            Vault.ObjectTypeOperations.GetObjectTypeIDByAlias("vObject.InvoiceDetail"),
            propertyValues,
            MFiles.CreateInstance("SourceObjectFiles"),
            MFiles.CreateInstance("AccessControlList"));

        Vault.ObjectOperations.CheckIn(oObjectVersionAndProperties.ObjVer);
    }
}

function CheckNull() {
    var tbl = document.getElementById('invoice_details_table');
    document.getElementById('invoice_details_table').rows.length
    for (var i = 1; i < tbl.rows.length - 1; i++) {
        for (var j = 1; j < 4; j++) {
            var val = tbl.rows[i].cells[j].querySelector('input').value;
            if (val === "" || val === 0 || val === "$") return false;
        }
    }

    return true;
}

function SaveInvoice() {

    if (!CheckNull()) {
        alert("Please check values!!");
        return;
    }

    var controller = gDashboard.customData;
    var editor = controller.Invoice;
    var Vault = controller.Vault;

    DestroyOldDetails(editor, Vault);
    CreateNewDetails(editor, Vault);

    RefreshTab();
}

function RefreshTab() {
    $(".panel-left").empty();
    $(".panel-left").append('<div id="tabs"><ul></ul></div>');
    $('#tabs').tabs({
        activate: function (event, ui) {
            var tabID = ui.newPanel[0].id;
        }
    });

    SetDetails(gDashboard);
    ChangeValue(true);
}

function DiscardInvoice() {
    var result = gDashboard.Parent.shellFrame.ShowMessage({
        caption: "Unsaved Changes",
        message: "You have unsaved changes to \"" + gDashboard.customData.ObjectVersion.Title + "\".",
        button1_title: "Save",
        button2_title: "Do Not Save",
        button3_title: "Cancel",
        defaultButton: 1
    });

    if (result == 1) SaveInvoice();     // save
    else if (result == 2) RefreshTab(); // don't save
}

function SetInvoiceDetails(controller) {
    var editor = controller.Invoice;
    var Vault = controller.Vault;
    var tabname = 'Invoice';
    var tabdisplayname = tabname;

    var self = this;

    CreateMetadataCard(controller, editor, tabname, tabdisplayname);
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.InvoiceNumber')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Date')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Vendor')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.POReference')

    DisplayImage(Vault, editor.ObjectVersionProperties);

    /*
        var InvNO = editor.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.InvoiceNumber", true).Value.DisplayValue;
    */
    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
        FindObjects(Vault, 'vObject.InvoiceDetail', 'vProperty.Invoice', MFDatatypeLookup, editor.ObjectVersion.ObjVer.ID), MFSearchFlagNone, true);

    /*
        var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
                FindObjects(Vault,'vObject.InvoiceDetail','vProperty.Invoice',MFDatatypeLookup, InvNO), MFSearchFlagNone, true);
    */
    editor.table.append(
        '<tr><td colspan="5" align="center">' +
        '    <table width="90%" id="invoice_details_table" class="details">' +
        '       <tr><th width="5%">-</th><th width="25%">Item</th><th width="20%">Qty</th><th width="25%">Unit $</th><th width="25%">Ext $</th></tr>' +
        '    </table>' +
        '</td></tr>' +
        '');
    var TableBody = editor.table.find('#invoice_details_table');
    var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
    var Total = 0

    if (ObjectSearchResults.Count > 0) {
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        for (var i = 0; i < ObjectSearchResults.Count; i++) {
            var props = ObjectSearchResultsProperties[i];
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.ItemNumber", true).Value.DisplayValue;
            var Qty = props.SearchForPropertyByAlias(Vault, "vProperty.Quantity", true).Value.DisplayValue;
            var Price = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value

            var htmlStr =
                '<tr>' +
                '   <td><img id="chk" src="UIControlLibrary/images/remove-button-red.png" title="delete item" alt="del" ' +
                '               onclick="removeRow(this)"></td > ' +
                '   <td><input type="text" id=\'ItemNumber' + i + '\' placeholder="' + Item + '" value="' + Item + '"></div></td > ' +
                '   <td><input type="text" id=\'Quantity' + i + '\' placeholder="' + Qty + '" value="' + Qty + '" ' +
                '       onkeyup="Calculate(\'Quantity' + i + '\', \'UnitPrice' + i + '\', \'Extension' + i + '\')" ' +
                '       onkeypress="return isNumberKey(event,this.id)" ></td> ' +
                '   <td><input type="text" id=\'UnitPrice' + i + '\' placeholder="' + Price + '" value="' + Price + '" ' +
                '       onkeyup="Calculate(\'Quantity' + i + '\', \'UnitPrice' + i + '\', \'Extension' + i + '\')" ' +
                '       onkeypress="return isNumberKey(event,this.id)" ></td> ' +
                '   <td><input type="text" id=\'Extension' + i + '\' placeholder="' + Amount + '" value="' + Amount + '" readonly="true"></td>' +
                "</tr>";
            TableBody.append(htmlStr);
        }
    }
    else {
        var htmlStr =
            '<tr>' +
            '   <td><img id="chk" src="UIControlLibrary/images/remove-button-red.png" title="delete item" alt="del" onclick="removeRow(this)"></td>' +
            '   <td><input type="text" id="ItemNumber0" placeholder="" value=""></td >' +
            '   <td><input type="text" id="Quantity0"  placeholder="" value="" onkeyup="Calculate(\'Quantity0\', \'UnitPrice0\', \'Extension0\')" ' +
            '       onkeypress="return isNumberKey(event,this.id)" ></td>' +
            '   <td><input type="text" id="UnitPrice0" placeholder="" value="" onkeyup="Calculate(\'Quantity0\', \'UnitPrice0\', \'Extension0\')" ' +
            '       onkeypress="return isNumberKey(event,this.id)" ></td> ' +
            '   <td><input type="text" id="Extension0" placeholder="" value="" readonly="true"></td>' +
            "</tr>";

        TableBody.append(htmlStr);
    }

    var subTotal = editor.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.subtotal", true).Value.DisplayValue;
    var balance = (subTotal != Total) ? "Not Balanced" : "Balanced";
    TableBody.append(
        '<tr>' +
        '<td style="border-bottom: none;border-left: none;">' +
        '<a id="addRow" href="#" title="Add Item" style="text-decoration:none" onclick=addRowToTable("invoice_details_table");>+</a></td> ' +
        '<td colspan="3" style="text-align:right;"><label id="Balanced" class="Balance ' + balance.split(" ").join("") + '">' + balance + '</label> ' +
        '<td><input type="text" id="Total" placeholder="' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) +
        '" value="' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '" readonly></td>' +
        '</tr>'
    );
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Subtotal')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Verified')

}

function SetPODetails(controller) {
    var editor = controller.PurchaseOrder;
    if (editor == undefined) return;
    var Vault = controller.Vault;
    var tabname = 'PO' + editor.ObjectVersion.Title;
    var tabdisplayname = 'PO ' + editor.ObjectVersion.Title;

    CreateMetadataCard(controller, editor, tabname, tabdisplayname);

    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PONumber')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Vendor')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PODate')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PORequiredDate')
    generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Currency')

    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
        FindObjects(Vault, 'vObject.PurchaseOrderDetail', 'vProperty.PurchaseOrder', MFDatatypeText, editor.ObjectVersion.Title), MFSearchFlagNone, true);
    if (ObjectSearchResults.Count > 0) {
        editor.table.append(
            '<tr><td colspan="5" align="center">' +
            '    <table width="90%" id="po_details_table" class="details">' +
            '        <tr><th width="7%">Line</th><th width="22%">Item</th><th>Ordered</th><th>RTD</th><th>Unit $</th><th width="18%">Ext $</th><th>Account</th></tr>' +
            '    </table>' +
            '</td></tr>' +
            '');

        var TableBody = editor.table.find('#po_details_table');
        var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        var Total = 0;
        var ArrayVal = [];
        var strTable = "";
        for (var i = 0; i < ObjectSearchResults.Count; i++) {
            var props = ObjectSearchResultsProperties[i];
            var LineNo = props.SearchForPropertyByAlias(Vault, "vProperty.POLine#", true).Value.DisplayValue;
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.POItem", true).Value.DisplayValue;
            var ItemNO = Item.split("=>");
            var ItemVal = ItemNO[0];
            var OrdQty = props.SearchForPropertyByAlias(Vault, "vProperty.OrderedQty", true).Value.DisplayValue;
            var RTDQty = props.SearchForPropertyByAlias(Vault, "vProperty.ReceivedQty", true).Value.DisplayValue;
            var Price = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Account = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccount", true).Value.DisplayValue;
            var AccountNO = Account.split(" ");
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value;
            strTable = '<tr>' +
                '<td style="text-align:center"><span id="LineNumber">' + LineNo + '</span></td>' +
                '<td style="text-align:center" style="word-wrap:break-word;" title="' + ItemNO[1] + '"><span id="ItemNumber">' + ItemNO[0] + '</span></td>' +
                '<td style="text-align:right"><span id="OrdQuantity">' + OrdQty + '</span></td>' +
                '<td style="text-align:right"><span id="RTDQuantity">' + RTDQty + '</span></td>' +
                '<td style="text-align:right"><span id="UnitPrice">' + Price + '</span></td>' +
                '<td style="text-align:right"><span id="Extension" title="' + Amount + '">' + Amount + '</span></td>' +
                '<td style="text-align:right" title="' + AccountNO.slice(2).join(" ") + '"><span id="Account">' + AccountNO.slice(0, 1) + '</span></td>' +
                "</tr>";
            // HKo; sort the list: 1, 10, 11, 2, 3 => 1, 2, 3, 10
            ArrayVal[i] = LineNo + ", " + strTable;
        }
        var SortedList = SortLineNo(ArrayVal).join();

        TableBody.append(SortedList);
        TableBody.append(
            '<tr>' +
            '<td colspan="7" style="border-bottom: none;border-left: none; text-align:right">' +
            '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '</tr>'
        );
    }
}

function SortLineNo(ArrayVal) {
    ArrayVal.sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    return ArrayVal;
}

function SetPSDetails(controller) {
    /* var editor=controller.PackingSlip;
     var Vault=controller.Vault;
     var tabname='PackingSlip';
     var tabdisplayname='Packing Slip';
 
     CreateMetadataCard(controller,editor,tabname,tabdisplayname);
 
     editor.table.append('<span>Packing Slip Details!</span>')*/

}

// A helper function to compile the search conditions needed for running the search in the
// vault using M-Files API.
function FindObjects(Vault, OTAlias, PDAlias, PDType, Value) {
    // We need a few IDs based on aliases defined in the M-Files Admin tool for object types, properties, etc.
    // Note that all these methods could be run asynchronously as well, if it seems they take a long time and block the UI.
    var OT = Vault.ObjectTypeOperations.GetObjectTypeIDByAlias(OTAlias);
    var PD = Vault.PropertyDefOperations.GetPropertyDefIDByAlias(PDAlias);

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

    // Search condition that defines that the object must refer to the given object.
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.DataPropertyValuePropertyDef = PD;
    oSC.TypedValue.SetValue(PDType, Value);
    oSCs.Add(-1, oSC);

    return oSCs;
}

function FindClassObjects(Vault, CTAlias, PDAlias, PDType, Value) {
    // We need a few IDs based on aliases defined in the M-Files Admin tool for object types, properties, etc.
    // Note that all these methods could be run asynchronously as well, if it seems they take a long time and block the UI.
    var CT = Vault.ClassOperations.GetObjectTypeIDByAlias(CTAlias);
    var PD = Vault.PropertyDefOperations.GetPropertyDefIDByAlias(PDAlias);

    var oSC = new MFiles.SearchCondition();
    var oSCs = new MFiles.SearchConditions();

    // Search condition that defines the object is not marked as deleted.
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.SetStatusValueExpression(MFStatusTypeDeleted, new MFiles.DataFunctionCall());
    oSC.TypedValue.SetValue(MFDatatypeBoolean, false);
    oSCs.Add(-1, oSC);

    // Search condition that defines the object type 
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.SetStatusValueExpression(MFStatusTypeObjectID, new MFiles.DataFunctionCall());
    oSC.TypedValue.SetValue(MFDatatypeLookup, CT);
    oSCs.Add(-1, oSC);

    // Search condition that defines that the object must refer to the given object.
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.DataPropertyValuePropertyDef = PD;
    oSC.TypedValue.SetValue(PDType, Value);
    oSCs.Add(-1, oSC);

    return oSCs;
}

function DisplayImage(Vault, ObjectVersionProperties) {

    var ctrlContainer = $('div.panel-right');
    var filepath = "";

    var DisplaySearchCondition = new MFiles.SearchCondition();
    var DisplaySearchConditions = new MFiles.SearchConditions();

    DisplaySearchCondition.ConditionType = MFConditionTypeEqual;
    DisplaySearchCondition.Expression.DataPropertyValuePropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.InvoiceName")
    DisplaySearchCondition.TypedValue.SetValue(MFDatatypeText, ObjectVersionProperties[0].Value.DisplayValue);
    DisplaySearchConditions.Add(-1, DisplaySearchCondition);


    var DisplayResult = Vault.ObjectSearchOperations.SearchForObjectsByConditions(DisplaySearchConditions, MFSearchFlagNone, false);
    var doc = Vault.ObjectOperations.GetLatestObjectVersionAndProperties(DisplayResult[0].ObjVer.ObjID, false);
    var file = doc.VersionData.Files(1);
    filepath = Vault.ObjectFileOperations.GetPathInDefaultView(doc.VersionData.ObjVer.ObjID, doc.VersionData.ObjVer.Version, file.FileVer.ID, file.FileVer.Version);

    // EXTRA: Also show a preview of the document related to this Invoice object.
    // Add the ActiveX control to the DOM. Were are not using jQuery here to access the DOM, but would obviously
    // be an option. For details, see:
    // https://www.m-files.com/UI_Extensibility_Framework/#Embedding%20Shell%20Listings%20in%20Dashboards.html
    ctrlContainer.html('<object id="preview-ctrl" classid="clsid:' + MFiles.CLSID.PreviewerCtrl + '"> </object>');

    // Use the control to show the given file preview (path comes from whoever is embedding this dashboard, in this
    // case it is within a tab on shellFrame.RightPane).
    var previewCtrl = document.getElementById('preview-ctrl');
    previewCtrl.ShowFilePreview(filepath);
    //	ctrlContainer.html('<span>' + filepath + '</span>');
}

function isRequired(assocPropDefs, propertyNumber) {
    for (var i = 0; i < assocPropDefs.Count; i++) {
        if (assocPropDefs[i].PropertyDef == propertyNumber)
            return assocPropDefs[i].Required;
    }
    return false;
}

function generate_row(tableID, Vault, ObjVerProperties, propertyAlias) {
    var propertyNumber = ObjVerProperties.SearchForPropertyByAlias(Vault, propertyAlias, true).PropertyDef;
    var PropertyDef = Vault.PropertyDefOperations.GetPropertyDef(propertyNumber);
    var propertyName = PropertyDef.Name;
    var propertyType = PropertyDef.DataType;
    var propertyValue = ObjVerProperties.SearchForPropertyByAlias(Vault, propertyAlias, true).Value.DisplayValue;
    var propertyEditable = (PropertyDef.AutomaticValueType == 0 ? 1 : 0);
    var classID = ObjVerProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
    var assocPropDefs = Vault.ClassOperations.GetObjectClass(classID).AssociatedPropertyDefs;
    var propertyRequired = isRequired(assocPropDefs, propertyNumber);
    if (propertyType == 8)
        propertyValue = ((propertyValue == 'Yes') ? 'Yes' : 'No');
    if (propertyType == 3)
        propertyValue = '$' + propertyValue;
    // Create container element
    var propertyLine = $('<tr>');
    propertyLine.addClass('mf-dynamic-row mf-property-' + propertyNumber);
    propertyLine.attr('id', propertyNumber)
    // Check if field is editable. If it is, add class 'mf-editable'
    if (propertyEditable)
        propertyLine.addClass('mf-editable');
    //	$(tableID).append(propertyLine);
    tableID.append(propertyLine);

    // Add hover handler (IE 10 css pseudo selector :hover is not detecting mouse leave events)
    propertyLine.hover(
        function () {

            // Set the hover theme. The special theme is set for workflow and workstates properties.
            $(this).addClass("ui-state-hover");
            if (propertyNumber == 38 || propertyNumber == 99)
                $(this).addClass("ui-footer-hover");
        },
        function () {

            // Remove the hover theme, as well as the special theme workflow and workstate properties.
            $(this).removeClass("ui-state-hover");
            if (propertyNumber == 38 || propertyNumber == 99)
                $(this).removeClass("ui-footer-hover");
        }
    );
    var sub = (propertyName == "Subtotal") ?
        '                <div><input type="hidden" id="hSubtotal" name="hSubtotal" value="' + propertyValue + '" disabled ></div > ' : "";

    propertyLine.append(
        '        <td class="mf-dynamic-namefield">' +
        '            <div>' +
        '                <span class="mf-property-' + propertyNumber + '-label">' + propertyName + '</span>' +
        '                <span class="mf-required-indicator">*</span>' +
        '            </div>' +
        '        </td>' +
        '        <td colspan="4" class="mf-dynamic-controlfield">' +
        '            <div class="mf-control mf-dynamic-control mf-text">' +
        '                <div class="mf-internal-container">' +
        '                    <div class="mf-internal-text mf-property-' + propertyNumber + '-text-0">' + propertyValue + '</div>' + sub +
        '                </div>' +
        '            </div>' +
        '        </td>'
    );


    if (!propertyRequired)
        requiredspan = propertyLine.find('.mf-required-indicator').hide();
}

function setProperty(Vault, editor, propertyAlias) {
    var ObjectVersionProperties = editor.ObjectVersionProperties
    var PropertyInfo = ObjectVersionProperties.SearchForPropertyByAlias(Vault, propertyAlias, true);
    var propertyNumber = PropertyInfo.PropertyDef;
    var PropertyDef = Vault.PropertyDefOperations.GetPropertyDef(propertyNumber);
    var propertyName = PropertyDef.Name;
    var propertyType = PropertyDef.DataType;
    var propertyValue = PropertyInfo.Value.DisplayValue;
    var propertyReadOnly = (PropertyDef.AutomaticValueType == 0 ? false : true);
    var classID = ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
    var assocPropDefs = Vault.ClassOperations.GetObjectClass(classID).AssociatedPropertyDefs;
    var propertyRequired = isRequired(assocPropDefs, propertyNumber);
    if (propertyType == 8)
        propertyValue = ((propertyValue == 'Yes') ? 'Yes' : 'No');
    if (propertyType == 3)
        propertyValue = '$' + propertyValue;

    var propertyObject = {
        AllowAdding: false,
        Events: editor.Events,
        Hierarchical: false,
        ID: PropertyDef,
        Label: propertyName,
        Linked: false,
        Modified: false,
        MustExist: true,
        PropertyDef: PropertyDef,
        ReadOnly: propertyReadOnly,
        RealObjectType: false,
        RealOTHierarchical: false,
        RealOTHierarchy: false,
        Type: propertyType,
        Value: propertyValue,
        valuelist: -2,
        ValueRequired: propertyRequired,
        Visible: true
    };
    return propertyObject
}

function setControlState(anyControlInEditMode, updateHighlights, updateTheme) {

    this.anyControlInEditMode = anyControlInEditMode;

    // If any control is in edit mode or model has modified values or this is uncreated object,
    // set the metadata card to edit mode.
    //RSS			if( anyControlInEditMode || this.controller.isModified() || this.controller.dataModel.UncreatedObject )
    if (anyControlInEditMode)
        this.editModeStarted(updateTheme);
    else
        this.viewModeStarted(updateTheme);

    if (updateHighlights) {

        var self = this;
        // something may have returned to view mode... update highlighting
        setTimeout(function () {
            self.updateHighlights(self.controller.editor);
        }, 0);
    }
}

function CreateMetadataCard(controller, editor, tabid, tabtitle) {
    var self = this;
    var Vault = controller.Vault;
    controller.editor = editor;
    if (typeof controller.cards === 'undefined')
        cardid = 0;
    else
        cardid = controller.cards + 1;
    controller.cards = cardid;

    editor.cardname = 'metadatacard-' + cardid;
    editor.tabname = tabid;
    editor.tabdisplayname = tabtitle;

    // Add the tab to the tab list
    $('<li><a href="#' + editor.tabname + '">' + editor.tabdisplayname + '</a></li>').appendTo("#tabs ul");
    $('<div id="' + editor.tabname + '"><div id="' + editor.cardname + '" class="mf-metadatacard mf-mode-properties"></div></div>').appendTo("#tabs");
    $("#tabs").tabs("refresh");

    // Add localization to the controller
    controller.localization = new localization();
    controller.getLocalization = function () {
        return controller.localization;
    };

    // Create and initialize metadatacard widget.
    var metadatacard = $('#' + editor.cardname);
    metadatacard.metadatacard({});
    // Enable configurability, disable logging.
    initParameters = { enableConfigurability: true, enableLogging: false }

    // Set initial metadata card mode to view mode. Don't try to update theme yet, because configuration data is not yet ready.
    metadatacard.metadatacard("initialize", controller, initParameters);

    var MetaCard = $('div #' + editor.cardname);
    MetaCard.addClass("mf-card-docked");

    var mfcontentDiv = $('<div>');
    mfcontentDiv.addClass('mf-content');
    mfcontentDiv.css('height', '600px');
    MetaCard.append(mfcontentDiv);

    var mfpropertiesviewDiv = $('<div>');
    mfpropertiesviewDiv.attr('id', 'mf-properties-view')
    mfcontentDiv.append(mfpropertiesviewDiv);

    var mfdynamiccontrolsDiv = $('<div>');
    mfdynamiccontrolsDiv.addClass('mf-dynamic-controls');
    mfpropertiesviewDiv.append(mfdynamiccontrolsDiv);

    var mfinternaldynamiccontrolsDiv = $('<div>');
    mfinternaldynamiccontrolsDiv.addClass('mf-internal-dynamic-controls');
    mfdynamiccontrolsDiv.append(mfinternaldynamiccontrolsDiv);

    var mfsectionDiv = $('<div>');
    mfsectionDiv.addClass('mf-section mf-section-properties');
    mfinternaldynamiccontrolsDiv.append(mfsectionDiv);

    var mfscrollableDiv = $('<div>');
    mfscrollableDiv.addClass('ui-scrollable');
    mfscrollableDiv.css('height', '600px');
    mfsectionDiv.append(mfscrollableDiv);

    var mfsectioncontentDiv = $('<div>');
    mfsectioncontentDiv.addClass('mf-section-content mf-dynamic-properties');
    mfsectioncontentDiv.attr('id', 'a' + cardid);
    mfscrollableDiv.append(mfsectioncontentDiv);

    var mfdynamicTab = $('<table>');
    mfdynamicTab.addClass('mf-dynamic-table');
    mfdynamicTab.attr('id', 'mf-property-table');
    mfsectioncontentDiv.append(mfdynamicTab);

    // Bind click event to this element with 'metadatacard' namespace.
    MetaCard.bind("click.metadatacard", function (event) {
        //alert("Card Clicked!!!");
        // metadatacard.requestEditMode(null);
        //self.editManager.requestEditMode(null);
    });

    editor.metadatacard = MetaCard;
    editor.table = $('div #' + editor.cardname + ' #mf-property-table');
}

function CreatePopupIcon() {
    $('<li style="float:right"><a href="#" target="popup" onclick="PopupDashboard(); return false;");">' +
        '<img src="UIControlLibrary/images/openlink_16.png"></a></li>').appendTo("#tabs ul");
    $('<div id="0"><div id="popupIcon"></div></div>').appendTo("#tabs");
}

function PopupDashboard() {
    gDashboard.Parent.shellFrame.ShowPopupDashboard("APInvoice", true, gDashboard.CustomData);
}
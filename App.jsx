import React, {useState, useCallback, useEffect, useMemo} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Platform,
  PermissionsAndroid,
  FlatList,
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  ActivityIndicator,
  Card,
  Divider,
  RadioButton,
  Dialog,
  Portal,
  PaperProvider,
} from 'react-native-paper';
import DocumentScanner from 'react-native-document-scanner-plugin';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {API_KEY} from '@env';

const RenderCommonFields = React.memo(({commonData, onChange, template}) => (
  <Card style={styles.card}>
    <Card.Title title="Common Fields" />
    <Card.Content>
      {template.commonFields.map((field, index) => (
        <View key={index} style={styles.inputContainer}>
          <TextInput
            mode="outlined"
            label={field}
            value={commonData[field.toLowerCase().replace(/ /g, '_')]}
            onChangeText={text =>
              onChange(field.toLowerCase().replace(/ /g, '_'), text)
            }
            style={styles.input}
          />
        </View>
      ))}
    </Card.Content>
  </Card>
));

const RenderItem = React.memo(({item, onChange, template}) => (
  <Card style={styles.card}>
    <Card.Content>
      {template.itemFields.map((field, index) => (
        <View key={index} style={styles.inputContainer}>
          <TextInput
            mode="outlined"
            label={field}
            value={item[field.toLowerCase().replace(/ /g, '_')]}
            onChangeText={text =>
              onChange(item.id, field.toLowerCase().replace(/ /g, '_'), text)
            }
            style={styles.input}
          />
        </View>
      ))}
      <Divider style={styles.divider} />
    </Card.Content>
  </Card>
));

const App = () => {
  const genAI = useMemo(() => new GoogleGenerativeAI(API_KEY), []);
  const model = useMemo(
    () => genAI.getGenerativeModel({model: 'gemini-1.5-flash'}),
    [genAI],
  );

  const [imageUri, setImageUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commonData, setCommonData] = useState({});
  const [formData, setFormData] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('template1');
  const [ErrMsg, setErrMsg] = useState('');
  const [visible, setVisible] = useState(false);

  const templates = {
    template1: {
      commonFields: [
        'GSTIN Number',
        'Invoice No',
        'Date',
        'Phone Number',
        'Vehicle Number',
        'Customer GSTN No',
        'Subtotal',
        'Weighment Charges',
        'Coolie & Handling Charges',
        'CGST',
        'SGST',
        'Round Off',
        'Total',
        'E-way Bill No',
      ],
      itemFields: [
        'Description of Goods',
        'HSN Code',
        'Number of Units',
        'Quantity',
        'Rate',
        'Amount',
      ],
    },
    template2: {
      commonFields: [
        'Seller Name',
        'IT PAN No',
        'GSTIN',
        'CIN',
        'Invoice No',
        'Date',
        'Internal No',
        'SO No & Date',
        'Product',
        'Dispatch From',
        'IRN',
        'Total Gross Wt',
        'Total Net Wt',
        'Total Basic Value Rs.',
        'Total Add Freight Rs.',
        'Total Taxable Value Rs.',
        'Total CGST Amount in Rs.',
        'Total SGST Amount in Rs.',
        'Total IGST Amount',
        'Total GST',
        'Total Invoice',
      ],
      itemFields: [
        'Description of Goods',
        'Batch/Code',
        'No of Bundles/Coils/Sheets',
        'HSN/SAC Code',
        'UoM',
        'Gross Wt',
        'Net Wt',
        'Ex-Mill Rate',
        'Rebate',
        'Basic',
        'Basic Value Rs.',
        'Add Freight Rs.',
        'Taxable Value Rs.',
        'CGST Amount in Rs.',
        'SGST Amount in Rs.',
        'IGST Amount',
      ],
    },
  };

  const openCamera = useCallback(async () => {
    try {
      if (
        Platform.OS === 'android' &&
        (await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        )) !== PermissionsAndroid.RESULTS.GRANTED
      ) {
        setErrMsg('Grant camera permissions to use document scanner.');
        setVisible(true);
        return;
      }
      const {scannedImages, status} = await DocumentScanner.scanDocument();
      if (scannedImages.length > 0 && status === 'success') {
        setImageUri(scannedImages[0]);
      } else {
        setErrMsg('Scan canceled. No image was scanned.');
        setVisible(true);
      }
    } catch (error) {
      setErrMsg('Failed to open the camera. Please try again.');
      setVisible(true);
    }
  }, []);

  const recognizeText = useCallback(async () => {
    if (imageUri) {
      setIsLoading(true);
      try {
        const result = await TextRecognition.recognize(imageUri);
        const prompt = `
Extract the following details from the given text and format them into a JSON object:
{
  "invoice": {
    "common": {
      ${templates[selectedTemplate].commonFields
        .map(field => `"${field.toLowerCase().replace(/ /g, '_')}": "string"`)
        .join(',\n')}
    },
    "items": [
      ${templates[selectedTemplate].itemFields
        .map(field => `"${field.toLowerCase().replace(/ /g, '_')}": "string"`)
        .join(',\n')}
    ]
  }
}
Do not include any other information such as terms and conditions. Ensure the keys are named exactly as specified.
`;

        const Gresult = await model.generateContent([prompt, result.text]);
        const response = Gresult.response;
        const formattedText = response.text().replace(/json|`/g, '');
        try {
          const parsedData = JSON.parse(formattedText);
          if (parsedData.invoice && parsedData.invoice.items) {
            setCommonData(parsedData.invoice.common);
            setFormData(
              parsedData.invoice.items.map((item, index) => ({
                id: (index + 1).toString(),
                ...item,
              })),
            );
          } else {
            throw new Error('Invalid data format');
          }
        } catch (parseError) {
          throw new Error('Failed to parse the JSON response');
        }
      } catch (error) {
        setErrMsg('Failed to extract text. Please try again.');
        setVisible(true);
      } finally {
        setIsLoading(false);
      }
    }
  }, [imageUri, model, selectedTemplate]);

  useEffect(() => {
    if (imageUri) {
      recognizeText();
    }
  }, [imageUri, recognizeText]);

  const handleCommonChange = (field, value) => {
    setCommonData(prevData => ({
      ...prevData,
      [field]: value,
    }));
  };

  const handleItemChange = (id, field, value) => {
    setFormData(prevData =>
      prevData.map(item => (item.id === id ? {...item, [field]: value} : item)),
    );
  };

  const handleSubmit = () => {
    console.log(
      JSON.stringify({
        invoice: {
          common: commonData,
          items: formData,
        },
      }),
    );
    setCommonData({});
    setFormData([]);
    // API logic
  };

  return (
    <PaperProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <RadioButton.Group
            onValueChange={value => setSelectedTemplate(value)}
            value={selectedTemplate}>
            <View style={styles.radioButtonRow}>
              <View style={styles.radioButtonContainer}>
                <RadioButton value="template1" />
                <Text>Template 1</Text>
              </View>
              <View style={styles.radioButtonContainer}>
                <RadioButton value="template2" />
                <Text>Template 2</Text>
              </View>
            </View>
          </RadioButton.Group>
          <Button mode="contained" onPress={openCamera} style={styles.button}>
            SCAN DOCCUMENT
          </Button>
          {isLoading && <ActivityIndicator animating={true} size="large" />}
        </View>

        {formData.length > 0 && (
          <FlatList
            ListHeaderComponent={
              <RenderCommonFields
                commonData={commonData}
                onChange={handleCommonChange}
                template={templates[selectedTemplate]}
              />
            }
            data={formData}
            renderItem={({item}) => (
              <RenderItem
                item={item}
                onChange={handleItemChange}
                template={templates[selectedTemplate]}
              />
            )}
            keyExtractor={item => item.id}
            ListFooterComponent={
              <>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  style={styles.submitButton}>
                  Submit
                </Button>
                <Divider style={styles.divider} />
              </>
            }
          />
        )}
      </SafeAreaView>
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Error</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{ErrMsg}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  contentContainer: {},
  headerContainer: {
    marginBottom: 16,
  },
  radioButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  radioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  card: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
  },
  button: {
    marginBottom: 12,
  },
  submitButton: {
    margin: 16,
  },
  divider: {
    marginVertical: 8,
  },
});

export default App;

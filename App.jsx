import React, {useEffect, useState} from 'react';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {
  Button,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {API_KEY} from '@env';

const App = () => {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({model: 'gemini-1.5-flash'});
  const [imageUri, setImageUri] = useState(null);
  const [recognizedText, setRecognizedText] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState([]);

  const openCamera = async () => {
    try {
      const {scannedImages} = await DocumentScanner.scanDocument();
      if (scannedImages.length > 0) {
        setImageUri(scannedImages[0]);
        console.log(scannedImages);
      } else {
        Alert.alert('Scan canceled', 'No image was scanned.');
      }
    } catch (error) {
      console.error('Error scanning document:', error);
      Alert.alert('Error', 'Failed to open the camera. Please try again.');
    }
  };

  const recognizeText = async () => {
    if (imageUri) {
      setIsLoading(true);
      try {
        const result = await TextRecognition.recognize(imageUri);
        const prompt = `
Extract the following details from the given text and format them into a JSON object:
{
  "invoice": {
    "items": [
      {
        "description": "string",
        "hsnCode": "string",
        "unit": "number",
        "quantity": "number",
        "rate": "number",
        "amount": "number"
      }
    ]
  }
}
Do not include any other information such as terms and conditions. Ensure the keys are named exactly as specified: "description", "hsnCode", "number of units", "quantity", "rate", and "amount and please extract number of units correctly which is a number not KG/Ton".
`;

        const Gresult = await model.generateContent([prompt, result.text]);
        const response = Gresult.response;
        const formattedText = response.text().replace(/json|`/g, '');
        const parsedData = JSON.parse(formattedText);
        //console.log(formattedText);
        console.log(
          '_________________________PARSED DATA_______________________________________',
        );
        console.log(result.text);
        setRecognizedText(parsedData.invoice);
        if (parsedData.invoice && parsedData.invoice.items) {
          setFormData(
            parsedData.invoice.items.map((item, index) => ({
              id: (index + 1).toString(),
              description: item.description,
              hsnCode: item.hsnCode,
              unit: item.unit,
              quantity: item.quantity.toString(),
              rate: item.rate.toString(),
              amount: item.amount.toString(),
            })),
          );
        } else {
          throw new Error('Invalid data format');
        }
      } catch (error) {
        Alert.alert('error', 'Please retake photo', [
          {text: 'OK', onPress: () => openCamera()},
        ]);
        setRecognizedText('Error extracting text');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (imageUri) {
      recognizeText();
    }
  }, [imageUri]);

  const handleChange = (id, field, value) => {
    setFormData(prevData =>
      prevData.map(item => (item.id === id ? {...item, [field]: value} : item)),
    );
  };

  // const validateFields = () => {
  //   for (const item of formData) {
  //     if (
  //       !item.description ||
  //       !item.hsnCode ||
  //       !item.unit ||
  //       !item.quantity ||
  //       !item.rate ||
  //       !item.amount
  //     ) {
  //       Alert.alert('Validation Error', 'All fields are required.');
  //       return false;
  //     }
  //   }
  //   return true;
  // };

  const renderItem = ({item}) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={item.description}
        onChangeText={text => handleChange(item.id, 'description', text)}
      />
      <Text style={styles.label}>HSN Code</Text>
      <TextInput
        style={styles.input}
        placeholder="HSN Code"
        value={item.hsnCode}
        onChangeText={text => handleChange(item.id, 'hsnCode', text)}
      />
      <Text style={styles.label}>Unit</Text>
      <TextInput
        style={styles.input}
        placeholder="Unit"
        value={item.unit}
        onChangeText={text => handleChange(item.id, 'unit', text)}
      />
      <Text style={styles.label}>Quantity</Text>
      <TextInput
        style={styles.input}
        placeholder="Quantity"
        value={item.quantity}
        keyboardType="numeric"
        onChangeText={text => handleChange(item.id, 'quantity', text)}
      />
      <Text style={styles.label}>Rate</Text>
      <TextInput
        style={styles.input}
        placeholder="Rate"
        value={item.rate}
        keyboardType="numeric"
        onChangeText={text => handleChange(item.id, 'rate', text)}
      />
      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="Amount"
        value={item.amount}
        keyboardType="numeric"
        onChangeText={text => handleChange(item.id, 'amount', text)}
      />
      <Text style={styles.label}>
        ------------------------------------------------------
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Button onPress={openCamera} title="Open Camera" />
      {isLoading ? <ActivityIndicator size="large" color="#0000ff" /> : ''}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={renderHeader}
        data={formData}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.contentContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  recognizedText: {
    textAlign: 'justify',
    fontSize: 16,
    marginVertical: 16,
  },
  inputContainer: {
    marginVertical: 8,
    width: '80%',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
    marginVertical: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 4,
  },
});

export default App;
